-- Run against an existing database that already has `tracks` from schema.sql
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS external_track_id TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS release_name TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS musical_key TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS is_explicit BOOLEAN;

CREATE UNIQUE INDEX IF NOT EXISTS tracks_external_track_id_key
  ON tracks (external_track_id)
  WHERE external_track_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tracks_genre_idx ON tracks (genre);
CREATE INDEX IF NOT EXISTS tracks_label_idx ON tracks (label);
CREATE INDEX IF NOT EXISTS tracks_musical_key_idx ON tracks (musical_key);
CREATE INDEX IF NOT EXISTS tracks_bpm_idx ON tracks (bpm);
