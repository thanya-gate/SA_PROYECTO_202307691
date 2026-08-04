package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"yousac.com/yousac/reproduccion-service/gen/reproduccionv1"
	"yousac.com/yousac/reproduccion-service/internal/application/service"
	"yousac.com/yousac/reproduccion-service/internal/config"
	"yousac.com/yousac/reproduccion-service/internal/infrastructure/persistence/postgres"
	grpcserver "yousac.com/yousac/reproduccion-service/internal/interfaces/grpc"
)

const grpcAddr = "127.0.0.1:50053"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		runHealthcheck()
		return
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[reproduccion-service] %v", err)
	}

	ctx := context.Background()
	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[reproduccion-service] %v", err)
	}
	defer pool.Close()
	log.Println("[reproduccion-service] Conectado a PostgreSQL (Database per Microservice)")

	repo := postgres.NewReproduccionRepository(pool)
	svc := service.New(repo)
	grpcServer := grpcserver.New(svc, cfg.Version)

	listener, err := net.Listen("tcp", ":"+cfg.GRPCPort)
	if err != nil {
		log.Fatalf("[reproduccion-service] no se pudo escuchar en :%s: %v", cfg.GRPCPort, err)
	}

	srv := grpc.NewServer()
	reproduccionv1.RegisterReproduccionServiceServer(srv, grpcServer)
	log.Printf("[reproduccion-service] gRPC escuchando en 0.0.0.0:%s", cfg.GRPCPort)
	if err := srv.Serve(listener); err != nil {
		log.Fatalf("[reproduccion-service] error del servidor gRPC: %v", err)
	}
}

// runHealthcheck verifica la salud del servicio vía gRPC (usado por Docker).
func runHealthcheck() {
	conn, err := grpc.NewClient(grpcAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		os.Exit(1)
	}
	defer conn.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	client := reproduccionv1.NewReproduccionServiceClient(conn)
	resp, err := client.Health(ctx, &reproduccionv1.HealthRequest{})
	if err != nil || resp.GetStatus() != "SERVING" {
		os.Exit(1)
	}
	fmt.Println("healthcheck ok")
}
