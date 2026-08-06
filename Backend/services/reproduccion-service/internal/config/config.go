package config

import (
	"errors"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	GRPCPort    string
	DatabaseURL string
	Version     string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	port := os.Getenv("GRPC_PORT")
	if port == "" {
		port = "50053"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL es obligatoria (Database per Microservice)")
	}

	return &Config{
		GRPCPort:    port,
		DatabaseURL: databaseURL,
		Version:     "0.2.0",
	}, nil
}
