begin;

alter table miraichi_app.backup_export_log
  drop constraint if exists backup_export_log_schema_version_check,
  add constraint backup_export_log_schema_version_check check (
    schema_version in (
      'miraichi.cloud-backup.v1',
      'miraichi.cloud-backup.v2',
      'miraichi.cloud-backup.v3'
    )
  );

commit;
