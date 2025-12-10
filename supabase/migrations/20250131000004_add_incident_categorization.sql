-- Migration: Add Incident Categorization System
-- Purpose: Add medical trauma and non-medical incident categorization
-- Date: 2025-01-31
-- Risk Level: LOW - All columns are nullable, backward compatible

-- ========================================
-- 1. ADD NEW COLUMNS
-- ========================================

-- Add incident_category column
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS incident_category TEXT;

-- Add trauma_subcategory column (only for medical trauma incidents)
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS trauma_subcategory TEXT;

-- Add severity_level column (enhanced severity assessment)
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS severity_level TEXT;

-- ========================================
-- 2. ADD CHECK CONSTRAINTS
-- ========================================

-- Valid incident categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_incident_category'
  ) THEN
    ALTER TABLE public.incidents
    ADD CONSTRAINT check_incident_category 
    CHECK (
      incident_category IS NULL OR 
      incident_category IN (
        'MEDICAL_TRAUMA',
        'MEDICAL_NON_TRAUMA',
        'NON_MEDICAL_SAFETY',
        'NON_MEDICAL_SECURITY',
        'NON_MEDICAL_ENVIRONMENTAL',
        'NON_MEDICAL_BEHAVIORAL',
        'OTHER'
      )
    );
  END IF;
END $$;

-- Valid trauma subcategory values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_trauma_subcategory_values'
  ) THEN
    ALTER TABLE public.incidents
    ADD CONSTRAINT check_trauma_subcategory_values
    CHECK (
      trauma_subcategory IS NULL OR 
      trauma_subcategory IN (
        'FALL_RELATED',
        'BLUNT_FORCE',
        'PENETRATING',
        'BURN',
        'FRACTURE_DISLOCATION',
        'HEAD_INJURY',
        'SPINAL_INJURY',
        'MULTI_SYSTEM',
        'OTHER_TRAUMA'
      )
    );
  END IF;
END $$;

-- Valid severity levels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_severity_level'
  ) THEN
    ALTER TABLE public.incidents
    ADD CONSTRAINT check_severity_level 
    CHECK (
      severity_level IS NULL OR 
      severity_level IN (
        'CRITICAL',
        'HIGH',
        'MODERATE',
        'LOW',
        'INFORMATIONAL'
      )
    );
  END IF;
END $$;

-- Note: Trauma subcategory requirement is enforced at application level
-- Database constraint would be too complex (requires checking incident_category)

-- ========================================
-- 3. CREATE INDEXES FOR ANALYTICS
-- ========================================

-- Index for incident_category (used in analytics grouping)
CREATE INDEX IF NOT EXISTS idx_incidents_incident_category 
ON public.incidents(incident_category) 
WHERE incident_category IS NOT NULL;

-- Index for trauma_subcategory (used in medical trauma analytics)
CREATE INDEX IF NOT EXISTS idx_incidents_trauma_subcategory 
ON public.incidents(trauma_subcategory) 
WHERE trauma_subcategory IS NOT NULL;

-- Index for severity_level (used in severity analytics)
CREATE INDEX IF NOT EXISTS idx_incidents_severity_level 
ON public.incidents(severity_level) 
WHERE severity_level IS NOT NULL;

-- Composite index for category + severity (common analytics query)
CREATE INDEX IF NOT EXISTS idx_incidents_category_severity 
ON public.incidents(incident_category, severity_level) 
WHERE incident_category IS NOT NULL AND severity_level IS NOT NULL;

-- ========================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON COLUMN public.incidents.incident_category IS 
'Categorization of incident: MEDICAL_TRAUMA, MEDICAL_NON_TRAUMA, NON_MEDICAL_SAFETY, NON_MEDICAL_SECURITY, NON_MEDICAL_ENVIRONMENTAL, NON_MEDICAL_BEHAVIORAL, OTHER';

COMMENT ON COLUMN public.incidents.trauma_subcategory IS 
'Sub-category for medical trauma incidents. Required when incident_category = MEDICAL_TRAUMA. Values: FALL_RELATED, BLUNT_FORCE, PENETRATING, BURN, FRACTURE_DISLOCATION, HEAD_INJURY, SPINAL_INJURY, MULTI_SYSTEM, OTHER_TRAUMA';

COMMENT ON COLUMN public.incidents.severity_level IS 
'Enhanced severity assessment: CRITICAL, HIGH, MODERATE, LOW, INFORMATIONAL. Maps to severity enum for backward compatibility.';

-- ========================================
-- 5. VERIFY MIGRATION
-- ========================================

-- Verify columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'incidents' 
    AND column_name = 'incident_category'
  ) THEN
    RAISE EXCEPTION 'Column incident_category was not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'incidents' 
    AND column_name = 'trauma_subcategory'
  ) THEN
    RAISE EXCEPTION 'Column trauma_subcategory was not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'incidents' 
    AND column_name = 'severity_level'
  ) THEN
    RAISE EXCEPTION 'Column severity_level was not created';
  END IF;
  
  RAISE NOTICE '✅ All incident categorization columns created successfully';
END $$;

