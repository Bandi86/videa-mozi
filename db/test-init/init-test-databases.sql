-- Test database initialization script
-- This script creates test databases for all microservices

-- Create test databases
CREATE DATABASE videa_mozi_users_test;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_users_test TO postgres;

CREATE DATABASE videa_mozi_content_test;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_content_test TO postgres;

CREATE DATABASE videa_mozi_social_test;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_social_test TO postgres;

CREATE DATABASE videa_mozi_moderation_test;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_moderation_test TO postgres;

CREATE DATABASE videa_mozi_media_test;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_media_test TO postgres;

CREATE DATABASE videa_mozi_monitoring_test;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_monitoring_test TO postgres;

CREATE DATABASE videa_mozi_gateway_test;
GRANT ALL PRIVILEGES ON DATABASE videa_mozi_gateway_test TO postgres;

-- Log test database creation
DO $$
BEGIN
    RAISE NOTICE 'Created TEST databases for microservices:';
    RAISE NOTICE '- videa_mozi_users_test';
    RAISE NOTICE '- videa_mozi_content_test';
    RAISE NOTICE '- videa_mozi_social_test';
    RAISE NOTICE '- videa_mozi_moderation_test';
    RAISE NOTICE '- videa_mozi_media_test';
    RAISE NOTICE '- videa_mozi_monitoring_test';
    RAISE NOTICE '- videa_mozi_gateway_test';
END $$;
