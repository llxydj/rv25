# RVOIS - Rescue Volunteers Operations Information System

RVOIS is an emergency response coordination system for Talisay City, Negros Occidental. The application allows residents to report incidents, volunteers to respond to incidents, and administrators to manage the system.

## Features

- **Resident Portal**: Report incidents, track incident status, view incident history
- **Volunteer Portal**: Respond to incidents, update incident status, view assigned incidents
- **Admin Portal**: Manage volunteers, assign incidents, view reports and analytics
- **Real-time Notifications**: Instant updates for all users
- **Offline Support**: Basic functionality when offline
- **PWA Support**: Install as a native app on mobile devices
- **Year-Based Report Organization**: Organize and manage reports by year with quarterly breakdowns
- **Report Archiving**: Archive reports at year-end for performance and audit trail benefits
- **Automated Backup System**: Hourly encrypted backups of critical incident data with quick recovery

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Authentication, Storage, Realtime)
- **Maps**: Leaflet
- **PWA**: next-pwa
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- pnpm 8.x or higher
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/rvois.git
   cd rvois
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a `.env.local` file in the root directory with the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   BACKUP_ENCRYPTION_KEY=your-super-secret-encryption-key-change-in-production
   ```

4. Run the development server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

1. Create a new Supabase project.
2. Run the SQL script in `supabase/schema.sql` to set up the database schema.
3. Configure Row-Level Security (RLS) policies as defined in the schema.
4. Run the migration scripts in `supabase/migrations/` to set up additional features:
   - `20251102000002_add_archived_field_to_reports.sql` - Adds archived field to reports
   - `20251102000003_add_year_based_indexes.sql` - Adds indexes for efficient year-based queries

## Deployment

### Vercel Deployment

1. Push your code to a GitHub repository.
2. Create a new project in Vercel.
3. Connect your GitHub repository.
4. Add the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BACKUP_ENCRYPTION_KEY`
5. Deploy the project.

## Backup System

RVOIS includes a comprehensive backup system to ensure critical incident data is protected:

### Features
- **Automated Hourly Backups**: Critical data is backed up every hour
- **Encrypted Storage**: All backups are encrypted with AES-256
- **Redundant Storage**: Backups stored in multiple locations
- **Quick Recovery**: Restore data in under an hour
- **Monitoring Dashboard**: Real-time backup status in admin panel
- **Alerting**: Immediate notifications on backup failures

### Backup Process
1. System automatically backs up critical incident data every hour
2. Data is encrypted before storage
3. Backups are stored locally and replicated to remote storage
4. Backup integrity is verified regularly
5. Failed backups trigger immediate alerts

### Recovery Process
1. Identify most recent successful backup
2. Download and decrypt backup
3. Restore data to database
4. Verify data integrity

### Management
- Start backup service: `pnpm backup:start`
- Trigger manual backup: `pnpm backup:manual`
- Restore from backup: `pnpm backup:restore <filename>`
- Verify backup integrity: `pnpm backup:verify`

## Testing

Run the test suite:

```bash
pnpm test
```

## Admin Features

### Year-Based Reports

The Admin Portal now includes enhanced reporting capabilities:

1. **Year-Based Organization**: Reports are organized by year (e.g., 2024, 2025)
2. **Hierarchical Navigation**: Year → Quarter (Q1, Q2, Q3, Q4) → Date Range
3. **Quarterly Breakdown**: Incident distribution across quarters with visualizations
4. **Report Archiving**: Archive reports at year-end for performance and audit trails
5. **Export Options**: Generate PDF and CSV reports for any selected year

To access year-based reports:
1. Navigate to Admin Dashboard → Reports
2. Select the "Yearly Reports" tab
3. Choose a year from the dropdown
4. View quarterly breakdowns, incident types, and status distributions
5. Export data as PDF or CSV
6. Archive reports for the selected year when needed

## Contributing

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/your-feature-name`.
3. Make your changes and commit them: `git commit -m 'Add some feature'`.
4. Push to the branch: `git push origin feature/your-feature-name`.
5. Submit a pull request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Talisay City Government for their support and collaboration
- All volunteers and residents who contributed to the development and testing of the system