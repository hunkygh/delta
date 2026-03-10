-- Enable "contact" as a first-class custom field type.

ALTER TABLE list_fields
  DROP CONSTRAINT IF EXISTS list_fields_type_check;

ALTER TABLE list_fields
  ADD CONSTRAINT list_fields_type_check
  CHECK (type IN ('status', 'select', 'text', 'number', 'date', 'boolean', 'contact'));

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
  ELSIF ftype = 'text' OR ftype = 'contact' THEN
    IF NEW.value_text IS NULL THEN
      RAISE EXCEPTION 'value_text is required for % field type', ftype;
    END IF;
    IF NEW.option_id IS NOT NULL OR NEW.value_number IS NOT NULL OR NEW.value_date IS NOT NULL OR NEW.value_boolean IS NOT NULL THEN
      RAISE EXCEPTION 'only value_text may be set for % field type', ftype;
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
