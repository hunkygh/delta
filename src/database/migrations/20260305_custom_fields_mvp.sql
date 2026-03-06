-- Phase: custom fields for lists/items (status/select/text/number/date/boolean)

CREATE TABLE IF NOT EXISTS list_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lanes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('status', 'select', 'text', 'number', 'date', 'boolean')),
  order_index INT NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, field_key)
);

CREATE TABLE IF NOT EXISTS field_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES list_fields(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  option_key TEXT NOT NULL,
  color_fill TEXT,
  color_border TEXT,
  color_text TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field_id, option_key)
);

CREATE TABLE IF NOT EXISTS item_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES list_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC,
  value_date TIMESTAMPTZ,
  value_boolean BOOLEAN,
  option_id UUID REFERENCES field_options(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_list_fields_user_list
  ON list_fields(user_id, list_id);

CREATE INDEX IF NOT EXISTS idx_list_fields_list_order
  ON list_fields(list_id, order_index);

CREATE INDEX IF NOT EXISTS idx_field_options_field_order
  ON field_options(field_id, order_index);

CREATE INDEX IF NOT EXISTS idx_item_field_values_item
  ON item_field_values(item_id);

CREATE INDEX IF NOT EXISTS idx_item_field_values_field
  ON item_field_values(field_id);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION set_custom_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_list_fields_updated_at ON list_fields;
CREATE TRIGGER trg_list_fields_updated_at
BEFORE UPDATE ON list_fields
FOR EACH ROW
EXECUTE FUNCTION set_custom_fields_updated_at();

DROP TRIGGER IF EXISTS trg_field_options_updated_at ON field_options;
CREATE TRIGGER trg_field_options_updated_at
BEFORE UPDATE ON field_options
FOR EACH ROW
EXECUTE FUNCTION set_custom_fields_updated_at();

DROP TRIGGER IF EXISTS trg_item_field_values_updated_at ON item_field_values;
CREATE TRIGGER trg_item_field_values_updated_at
BEFORE UPDATE ON item_field_values
FOR EACH ROW
EXECUTE FUNCTION set_custom_fields_updated_at();

-- Enforce typed value consistency based on field type
CREATE OR REPLACE FUNCTION validate_item_field_value()
RETURNS TRIGGER AS $$
DECLARE
  ftype TEXT;
BEGIN
  SELECT type INTO ftype
  FROM list_fields
  WHERE id = NEW.field_id;

  IF ftype IS NULL THEN
    RAISE EXCEPTION 'Unknown field_id %', NEW.field_id;
  END IF;

  IF ftype IN ('status', 'select') THEN
    IF NEW.option_id IS NULL THEN
      RAISE EXCEPTION 'option_id is required for % field type', ftype;
    END IF;
    IF NEW.value_text IS NOT NULL OR NEW.value_number IS NOT NULL OR NEW.value_date IS NOT NULL OR NEW.value_boolean IS NOT NULL THEN
      RAISE EXCEPTION 'scalar value columns must be null for % field type', ftype;
    END IF;
  ELSIF ftype = 'text' THEN
    IF NEW.value_text IS NULL THEN
      RAISE EXCEPTION 'value_text is required for text field type';
    END IF;
    IF NEW.option_id IS NOT NULL OR NEW.value_number IS NOT NULL OR NEW.value_date IS NOT NULL OR NEW.value_boolean IS NOT NULL THEN
      RAISE EXCEPTION 'only value_text may be set for text field type';
    END IF;
  ELSIF ftype = 'number' THEN
    IF NEW.value_number IS NULL THEN
      RAISE EXCEPTION 'value_number is required for number field type';
    END IF;
    IF NEW.option_id IS NOT NULL OR NEW.value_text IS NOT NULL OR NEW.value_date IS NOT NULL OR NEW.value_boolean IS NOT NULL THEN
      RAISE EXCEPTION 'only value_number may be set for number field type';
    END IF;
  ELSIF ftype = 'date' THEN
    IF NEW.value_date IS NULL THEN
      RAISE EXCEPTION 'value_date is required for date field type';
    END IF;
    IF NEW.option_id IS NOT NULL OR NEW.value_text IS NOT NULL OR NEW.value_number IS NOT NULL OR NEW.value_boolean IS NOT NULL THEN
      RAISE EXCEPTION 'only value_date may be set for date field type';
    END IF;
  ELSIF ftype = 'boolean' THEN
    IF NEW.value_boolean IS NULL THEN
      RAISE EXCEPTION 'value_boolean is required for boolean field type';
    END IF;
    IF NEW.option_id IS NOT NULL OR NEW.value_text IS NOT NULL OR NEW.value_number IS NOT NULL OR NEW.value_date IS NOT NULL THEN
      RAISE EXCEPTION 'only value_boolean may be set for boolean field type';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_item_field_values_validate ON item_field_values;
CREATE TRIGGER trg_item_field_values_validate
BEFORE INSERT OR UPDATE ON item_field_values
FOR EACH ROW
EXECUTE FUNCTION validate_item_field_value();

ALTER TABLE list_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_field_values ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'list_fields'
      AND policyname = 'Users can view own list_fields'
  ) THEN
    CREATE POLICY "Users can view own list_fields"
      ON list_fields FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'list_fields'
      AND policyname = 'Users can insert own list_fields'
  ) THEN
    CREATE POLICY "Users can insert own list_fields"
      ON list_fields FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'list_fields'
      AND policyname = 'Users can update own list_fields'
  ) THEN
    CREATE POLICY "Users can update own list_fields"
      ON list_fields FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'list_fields'
      AND policyname = 'Users can delete own list_fields'
  ) THEN
    CREATE POLICY "Users can delete own list_fields"
      ON list_fields FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'field_options'
      AND policyname = 'Users can view own field_options'
  ) THEN
    CREATE POLICY "Users can view own field_options"
      ON field_options FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'field_options'
      AND policyname = 'Users can insert own field_options'
  ) THEN
    CREATE POLICY "Users can insert own field_options"
      ON field_options FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'field_options'
      AND policyname = 'Users can update own field_options'
  ) THEN
    CREATE POLICY "Users can update own field_options"
      ON field_options FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'field_options'
      AND policyname = 'Users can delete own field_options'
  ) THEN
    CREATE POLICY "Users can delete own field_options"
      ON field_options FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_field_values'
      AND policyname = 'Users can view own item_field_values'
  ) THEN
    CREATE POLICY "Users can view own item_field_values"
      ON item_field_values FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_field_values'
      AND policyname = 'Users can insert own item_field_values'
  ) THEN
    CREATE POLICY "Users can insert own item_field_values"
      ON item_field_values FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_field_values'
      AND policyname = 'Users can update own item_field_values'
  ) THEN
    CREATE POLICY "Users can update own item_field_values"
      ON item_field_values FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_field_values'
      AND policyname = 'Users can delete own item_field_values'
  ) THEN
    CREATE POLICY "Users can delete own item_field_values"
      ON item_field_values FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
