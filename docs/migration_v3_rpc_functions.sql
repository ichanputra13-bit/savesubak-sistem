-- ============================================================
-- AgriMRV — Migration v3: View + RPC Functions
-- Nama query di SQL Editor: 03_rpc_insert_plot_and_view
-- ============================================================


-- ============ 1. VIEW: plots dengan geo_data sebagai GeoJSON ============
-- security_invoker = true supaya RLS dari tabel plots tetap berlaku
create or replace view v_plots
  with (security_invoker = true)
as
select
  p.id,
  p.kawasan_id,
  p.farmer_name,
  p.crop_variety,
  p.area_ha,
  p.scan_interval_days,
  p.is_organic_certified,
  p.created_at,
  ST_AsGeoJSON(p.geo_data)::jsonb as geo_data
from plots p;


-- ============ 2. RPC: insert plot baru dengan GeoJSON polygon ============
create or replace function insert_plot(
  p_kawasan_id       uuid,
  p_farmer_name      text,
  p_crop_variety     text,
  p_area_ha          numeric,
  p_geo_data         jsonb
)
returns json
language plpgsql
security invoker        -- jalankan dengan hak akses pemanggil (RLS tetap berlaku)
as $$
declare
  new_id uuid;
begin
  insert into plots (kawasan_id, farmer_name, crop_variety, area_ha, geo_data)
  values (
    p_kawasan_id,
    p_farmer_name,
    p_crop_variety,
    p_area_ha,
    ST_SetSRID(ST_GeomFromGeoJSON(p_geo_data::text), 4326)
  )
  returning id into new_id;

  return json_build_object('id', new_id);
end;
$$;

-- Grant execute ke role authenticated (RLS di tabel plots tetap jadi penjaga akses)
grant execute on function insert_plot to authenticated;
grant execute on function insert_plot to service_role;


-- ============ VERIFIKASI ============
select viewname from pg_views where viewname = 'v_plots';
