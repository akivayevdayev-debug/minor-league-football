-- ════════════════════════════════════════════════════════════════════════════
-- MLF change 002: league settings, scoring types and stat types (no personal data).
-- Paste into Supabase → SQL Editor → Run, after 001. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.scoring_types (id, label, points, display_order) values
  ('td',           'Touchdown',                    6,    1),
  ('conv1',        '1-point conversion',           1,    2),
  ('conv2',        '2-point conversion',           2,    3),
  ('final_manual', 'Final score (entered by hand)', null, 99)
on conflict (id) do nothing;

insert into public.stat_types (id, label, display_order) values
  ('rec',      'Receptions',                              1),
  ('target',   'Targets',                                 2),
  ('drop',     'Drops',                                   3),
  ('td',       'Touchdowns',                              4),
  ('fumble',   'Fumbles',                                 5),
  ('int',      'Interceptions',                           6),
  ('pick6',    'Pick 6',                                  7),
  ('conv1',    '1-point conversion',                      8),
  ('conv2',    '2-point conversion',                      9),
  ('block',    'Blocks',                                  10),
  ('conv_old', 'Conversion (old sheet, 1 or 2 pt not split)', 11)
on conflict (id) do nothing;
