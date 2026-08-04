package config

import (
	"errors"
	"os"

	"github.com/joho/godotenv"
)

// Config reúne las variables de entorno del microservicio.
type Config struct {
	GRPCPort    string
	DatabaseURL string
	Version     string
}

// Load lee la configuración desde el entorno (.env opcional en local).
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
