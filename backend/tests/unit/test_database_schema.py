"""
Unit tests for database schema
Tests table creation, constraints, and foreign key relationships
Requirements: 23.2
"""
import pytest
import os
from pathlib import Path


class TestDatabaseSchemaStructure:
    """
    Tests for database schema structure and SQL file validity
    """
    
    def test_schema_file_exists(self):
        """
        Test that the schema.sql file exists
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        assert schema_path.exists(), "schema.sql file should exist"
        assert schema_path.is_file(), "schema.sql should be a file"
    
    def test_schema_file_not_empty(self):
        """
        Test that the schema.sql file is not empty
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        assert len(content) > 0, "schema.sql should not be empty"
        assert "CREATE TABLE" in content, "schema.sql should contain CREATE TABLE statements"
    
    def test_schema_has_required_extensions(self):
        """
        Test that schema enables required PostgreSQL extensions
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"' in content, \
            "Schema should enable uuid-ossp extension"
        assert 'CREATE EXTENSION IF NOT EXISTS "pgvector"' in content, \
            "Schema should enable pgvector extension"


class TestTableDefinitions:
    """
    Tests for individual table definitions in the schema
    """
    
    def test_users_table_definition(self):
        """
        Test that users table has all required fields
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        # Check table creation
        assert "CREATE TABLE IF NOT EXISTS users" in content
        
        # Check required fields
        required_fields = [
            "id UUID PRIMARY KEY",
            "email TEXT UNIQUE NOT NULL",
            "name TEXT",
            "plan TEXT NOT NULL DEFAULT 'free'",
            "role TEXT",
            "personal_api_key TEXT",
            "created_at TIMESTAMPTZ",
            "updated_at TIMESTAMPTZ",
            "disabled BOOLEAN"
        ]
        
        for field in required_fields:
            assert field in content, f"Users table should have {field}"
        
        # Check plan constraint
        assert "CHECK (plan IN ('free', 'student', 'pro', 'admin'))" in content
        
        # Check role constraint
        assert "CHECK (role IN ('super_admin', 'admin', 'ops', 'support', 'viewer'))" in content
    
    def test_admin_allowlist_table_definition(self):
        """
        Test that admin_allowlist table has all required fields
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS admin_allowlist" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "email TEXT UNIQUE NOT NULL",
            "role TEXT NOT NULL",
            "added_by UUID REFERENCES users(id)",
            "created_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"admin_allowlist table should have {field}"
    
    def test_usage_counters_table_definition(self):
        """
        Test that usage_counters table has all required tracking fields
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS usage_counters" in content
        
        # Check all tracking fields
        tracking_fields = [
            "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE",
            "date DATE NOT NULL DEFAULT CURRENT_DATE",
            "tokens_used INTEGER",
            "requests_count INTEGER",
            "pdf_uploads INTEGER",
            "mcqs_generated INTEGER",
            "images_used INTEGER",
            "flashcards_generated INTEGER",
            "UNIQUE(user_id, date)"
        ]
        
        for field in tracking_fields:
            assert field in content, f"usage_counters table should have {field}"
    
    def test_api_keys_table_definition(self):
        """
        Test that api_keys table has encryption support and priority fields
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS api_keys" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "provider TEXT NOT NULL",
            "feature TEXT NOT NULL",
            "key_value TEXT NOT NULL",  # encrypted
            "priority INTEGER NOT NULL DEFAULT 0",
            "status TEXT NOT NULL DEFAULT 'active'",
            "failure_count INTEGER",
            "last_used_at TIMESTAMPTZ",
            "created_at TIMESTAMPTZ",
            "updated_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"api_keys table should have {field}"
        
        # Check status constraint
        assert "CHECK (status IN ('active', 'degraded', 'disabled'))" in content
    
    def test_provider_health_table_definition(self):
        """
        Test that provider_health table exists with required fields
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS provider_health" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE",
            "checked_at TIMESTAMPTZ",
            "status TEXT NOT NULL",
            "response_time_ms INTEGER",
            "error_message TEXT",
            "quota_remaining INTEGER"
        ]
        
        for field in required_fields:
            assert field in content, f"provider_health table should have {field}"
    
    def test_system_flags_table_definition(self):
        """
        Test that system_flags table exists for feature toggles
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS system_flags" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "flag_name TEXT UNIQUE NOT NULL",
            "flag_value TEXT NOT NULL",
            "updated_by UUID REFERENCES users(id)",
            "updated_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"system_flags table should have {field}"
    
    def test_documents_table_definition(self):
        """
        Test that documents table exists for PDF/image uploads
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS documents" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE",
            "filename TEXT NOT NULL",
            "file_type TEXT NOT NULL",
            "file_size INTEGER NOT NULL",
            "storage_path TEXT NOT NULL",
            "processing_status TEXT NOT NULL DEFAULT 'pending'",
            "created_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"documents table should have {field}"
    
    def test_embeddings_table_definition(self):
        """
        Test that embeddings table exists with pgvector support
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS embeddings" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE",
            "chunk_text TEXT NOT NULL",
            "chunk_index INTEGER NOT NULL",
            "embedding VECTOR(768)",
            "created_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"embeddings table should have {field}"
        
        # Check vector index
        assert "CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat" in content
    
    def test_chat_sessions_table_definition(self):
        """
        Test that chat_sessions table exists
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS chat_sessions" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE",
            "title TEXT",
            "created_at TIMESTAMPTZ",
            "updated_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"chat_sessions table should have {field}"
    
    def test_messages_table_definition(self):
        """
        Test that messages table exists with citations support
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS messages" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE",
            "role TEXT NOT NULL",
            "content TEXT NOT NULL",
            "tokens_used INTEGER",
            "citations JSONB",
            "created_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"messages table should have {field}"
        
        # Check role constraint
        assert "CHECK (role IN ('user', 'assistant', 'system'))" in content
    
    def test_subscriptions_table_definition(self):
        """
        Test that subscriptions table exists
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS subscriptions" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE",
            "plan TEXT NOT NULL",
            "razorpay_subscription_id TEXT UNIQUE",
            "status TEXT NOT NULL",
            "current_period_start TIMESTAMPTZ",
            "current_period_end TIMESTAMPTZ",
            "created_at TIMESTAMPTZ",
            "updated_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"subscriptions table should have {field}"
    
    def test_payments_table_definition(self):
        """
        Test that payments table exists
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS payments" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE",
            "subscription_id UUID REFERENCES subscriptions(id)",
            "razorpay_payment_id TEXT UNIQUE",
            "amount INTEGER NOT NULL",
            "currency TEXT NOT NULL DEFAULT 'INR'",
            "status TEXT NOT NULL",
            "created_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"payments table should have {field}"
    
    def test_audit_logs_table_definition(self):
        """
        Test that audit_logs table exists
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TABLE IF NOT EXISTS audit_logs" in content
        
        required_fields = [
            "id UUID PRIMARY KEY",
            "admin_id UUID REFERENCES users(id)",
            "action_type TEXT NOT NULL",
            "target_type TEXT",
            "target_id TEXT",
            "details JSONB",
            "created_at TIMESTAMPTZ"
        ]
        
        for field in required_fields:
            assert field in content, f"audit_logs table should have {field}"


class TestForeignKeyRelationships:
    """
    Tests for foreign key relationships between tables
    Requirements: 23.2
    """
    
    def test_usage_counters_user_foreign_key(self):
        """
        Test that usage_counters has foreign key to users with CASCADE delete
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE" in content
    
    def test_admin_allowlist_user_foreign_key(self):
        """
        Test that admin_allowlist has foreign key to users
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "added_by UUID REFERENCES users(id)" in content
    
    def test_provider_health_api_key_foreign_key(self):
        """
        Test that provider_health has foreign key to api_keys with CASCADE delete
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE" in content
    
    def test_documents_user_foreign_key(self):
        """
        Test that documents has foreign key to users with CASCADE delete
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        # Check in documents table section
        documents_section = content[content.find("CREATE TABLE IF NOT EXISTS documents"):
                                   content.find("CREATE TABLE IF NOT EXISTS embeddings")]
        assert "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE" in documents_section
    
    def test_embeddings_document_foreign_key(self):
        """
        Test that embeddings has foreign key to documents with CASCADE delete
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE" in content
    
    def test_chat_sessions_user_foreign_key(self):
        """
        Test that chat_sessions has foreign key to users with CASCADE delete
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        # Check in chat_sessions table section
        sessions_section = content[content.find("CREATE TABLE IF NOT EXISTS chat_sessions"):
                                  content.find("CREATE TABLE IF NOT EXISTS messages")]
        assert "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE" in sessions_section
    
    def test_messages_session_foreign_key(self):
        """
        Test that messages has foreign key to chat_sessions with CASCADE delete
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE" in content
    
    def test_subscriptions_user_foreign_key(self):
        """
        Test that subscriptions has foreign key to users with CASCADE delete
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        # Check in subscriptions table section
        subscriptions_section = content[content.find("CREATE TABLE IF NOT EXISTS subscriptions"):
                                       content.find("CREATE TABLE IF NOT EXISTS payments")]
        assert "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE" in subscriptions_section
    
    def test_payments_user_and_subscription_foreign_keys(self):
        """
        Test that payments has foreign keys to users and subscriptions
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        # Check in payments table section
        payments_section = content[content.find("CREATE TABLE IF NOT EXISTS payments"):
                                  content.find("CREATE TABLE IF NOT EXISTS audit_logs")]
        assert "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE" in payments_section
        assert "subscription_id UUID REFERENCES subscriptions(id)" in payments_section


class TestIndexes:
    """
    Tests for database indexes
    Requirements: 23.2
    """
    
    def test_users_indexes(self):
        """
        Test that users table has required indexes
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)" in content
        assert "CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan)" in content
    
    def test_usage_counters_indexes(self):
        """
        Test that usage_counters table has required indexes
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE INDEX IF NOT EXISTS idx_usage_counters_user_date ON usage_counters(user_id, date)" in content
    
    def test_api_keys_indexes(self):
        """
        Test that api_keys table has required indexes
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE INDEX IF NOT EXISTS idx_api_keys_provider_feature ON api_keys(provider, feature)" in content
        assert "CREATE INDEX IF NOT EXISTS idx_api_keys_status_priority ON api_keys(status, priority DESC)" in content
    
    def test_embeddings_vector_index(self):
        """
        Test that embeddings table has vector similarity index
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops)" in content
    
    def test_audit_logs_indexes(self):
        """
        Test that audit_logs table has required indexes
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created ON audit_logs(admin_id, created_at DESC)" in content
        assert "CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action_type, created_at DESC)" in content


class TestConstraints:
    """
    Tests for database constraints
    Requirements: 23.2
    """
    
    def test_users_plan_constraint(self):
        """
        Test that users table has plan constraint
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CHECK (plan IN ('free', 'student', 'pro', 'admin'))" in content
    
    def test_users_role_constraint(self):
        """
        Test that users table has role constraint
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CHECK (role IN ('super_admin', 'admin', 'ops', 'support', 'viewer'))" in content
    
    def test_api_keys_status_constraint(self):
        """
        Test that api_keys table has status constraint
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CHECK (status IN ('active', 'degraded', 'disabled'))" in content
    
    def test_usage_counters_unique_constraint(self):
        """
        Test that usage_counters has unique constraint on user_id and date
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "UNIQUE(user_id, date)" in content
    
    def test_unique_email_constraints(self):
        """
        Test that email fields have unique constraints where required
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        # Users table
        users_section = content[content.find("CREATE TABLE IF NOT EXISTS users"):
                               content.find("CREATE TABLE IF NOT EXISTS admin_allowlist")]
        assert "email TEXT UNIQUE NOT NULL" in users_section
        
        # Admin allowlist table
        admin_section = content[content.find("CREATE TABLE IF NOT EXISTS admin_allowlist"):
                               content.find("CREATE TABLE IF NOT EXISTS usage_counters")]
        assert "email TEXT UNIQUE NOT NULL" in admin_section


class TestTriggers:
    """
    Tests for database triggers
    Requirements: 23.2
    """
    
    def test_updated_at_trigger_function(self):
        """
        Test that updated_at trigger function exists
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE OR REPLACE FUNCTION update_updated_at_column()" in content
        assert "NEW.updated_at = NOW()" in content
    
    def test_users_updated_at_trigger(self):
        """
        Test that users table has updated_at trigger
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users" in content
    
    def test_api_keys_updated_at_trigger(self):
        """
        Test that api_keys table has updated_at trigger
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys" in content
    
    def test_chat_sessions_updated_at_trigger(self):
        """
        Test that chat_sessions table has updated_at trigger
        Requirements: 23.2
        """
        schema_path = Path(__file__).parent.parent.parent / "database" / "schema.sql"
        content = schema_path.read_text()
        
        assert "CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions" in content
