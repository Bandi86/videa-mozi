-- Database initialization script for microservices architecture
-- This script creates all required databases and sets up proper permissions

-- Create database for User Service
CREATE DATABASE videa_mozi_users;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_users TO postgres;

-- Create database for Content Service
CREATE DATABASE videa_mozi_content;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_content TO postgres;

-- Create database for Social Service
CREATE DATABASE videa_mozi_social;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_social TO postgres;

-- Create database for Moderation Service
CREATE DATABASE videa_mozi_moderation;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_moderation TO postgres;

-- Create database for Media Service
CREATE DATABASE videa_mozi_media;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_media TO postgres;

-- Create database for Monitoring Service
CREATE DATABASE videa_mozi_monitoring;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_monitoring TO postgres;

-- Create database for API Gateway (if needed for logging/metrics)
CREATE DATABASE videa_mozi_gateway;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_gateway TO postgres;

-- Log the database creation
DO $$
BEGIN
    RAISE NOTICE 'Created databases for microservices architecture:';
    RAISE NOTICE '- videa_mozi_users (User Service)';
    RAISE NOTICE '- videa_mozi_content (Content Service)';
    RAISE NOTICE '- videa_mozi_social (Social Service)';
    RAISE NOTICE '- videa_mozi_moderation (Moderation Service)';
    RAISE NOTICE '- videa_mozi_media (Media Service)';
    RAISE NOTICE '- videa_mozi_monitoring (Monitoring Service)';
    RAISE NOTICE '- videa_mozi_gateway (API Gateway)';
END $$;
