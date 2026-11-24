import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Live MySQL already has PHP/legacy tables. Prisma must not db-push those
 * (it would drop extra columns/tables). Promocode columns are applied with:
 *   npm run db:ensure-promocode-meta
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL')
  },
  experimental: {
    externalTables: true
  },
  tables: {
    external: [
      'admins',
      'adminsettings',
      'admin_setting_for_users',
      'legacy_id_mappings',
      'users',
      'countries',
      'flags',
      'legacy_users',
      'languages_new',
      'promocode_settings',
      'promocode_applies',
      'promocode_monthly_stats',
      'subscription_settings',
      'help_html_pages',
      'language_values',
      'language_paragraphs',
      'food_database_sections',
      'food_database_items',
      'food_database_recipes',
      'food_database_source_imports',
      'food_database_source_state',
    ]
  }
});
