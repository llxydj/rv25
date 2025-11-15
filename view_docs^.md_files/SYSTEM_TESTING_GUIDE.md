# RVOIS System Testing Guide

This guide explains how to efficiently test the Rescue Volunteers Operations Information System (RVOIS) covering all core features and functionalities.

## Overview

The RVOIS testing framework provides multiple approaches for validating system functionality:
1. **Automated Testing** - Quick validation of code quality and build integrity
2. **Manual Testing** - Comprehensive feature validation using checklists
3. **Comprehensive Testing** - Detailed end-to-end system validation

## Quick Start: Automated Testing

Run the quick automated test suite:

```bash
# On Windows
test-system.bat

# On macOS/Linux
chmod +x test-system.sh
./test-system.sh
```

This will execute:
- Unit tests
- TypeScript type checking
- Code linting
- Build validation

## Comprehensive Testing Approach

### 1. Pre-requisites

Before testing, ensure you have:
- Supabase backend configured and running
- Environment variables in `.env.local`
- Test accounts created for all user roles
- Development server running (`pnpm dev`)

### 2. Automated Test Execution

Run the advanced test executor:

```bash
npx ts-node scripts/system-test-executor.ts
```

This script will:
- Start the development server automatically
- Run all test suites
- Generate detailed reports
- Stop the server when complete

### 3. Manual Testing with Checklist

Use the [SYSTEM_TESTING_CHECKLIST.md](file://c:\Users\Jasmin\Downloads\rvr\SYSTEM_TESTING_CHECKLIST.md) for systematic manual testing:

1. Open the checklist document
2. Follow the structured approach for each role
3. Check off completed items
4. Document any issues found

### 4. Feature-Specific Testing

Refer to [COMPREHENSIVE_SYSTEM_TESTING_SCRIPT.md](file://c:\Users\Jasmin\Downloads\rvr\COMPREHENSIVE_SYSTEM_TESTING_SCRIPT.md) for detailed test cases:

#### Admin Portal Testing
- Incident monitoring and reporting
- Activity scheduling and volunteer management
- Geolocation services and mapping
- Notification systems
- Report generation

#### Resident Portal Testing
- Incident reporting workflow
- Direct call functionality
- Geolocation services

#### Volunteer Portal Testing
- Incident response workflow
- Location tracking
- Status updates

#### Cross-cutting Features
- Notification alerts
- Real-time location tracking
- Mobile PWA functionality
- SMS notifications (where applicable)

## Testing Roles and Responsibilities

### Test Coordinator
- Oversees entire testing process
- Ensures all test cases are executed
- Manages test environment
- Generates final test reports

### Role-Specific Testers
- **Admin Tester**: Validates admin portal functionality
- **Resident Tester**: Tests resident reporting features
- **Volunteer Tester**: Verifies volunteer response workflows
- **Barangay Tester**: Checks barangay coordination features

## Test Environment Setup

### Supabase Configuration
1. Create test database
2. Apply latest migrations
3. Set up test users with proper roles
4. Configure RLS policies

### Test Accounts
Create accounts for:
- 1 Admin user
- 3 Volunteer users with different skills
- 2 Resident users
- 1 Barangay user

### Browser Setup
- Use multiple browser sessions or private windows
- Test on different browsers (Chrome, Firefox, Safari, Edge)
- Test on mobile devices for PWA functionality

## Test Data Preparation

### Sample Incident Types
- FIRE
- FLOOD
- MEDICAL EMERGENCY
- CRIME
- TRAFFIC ACCIDENT

### Sample Barangays
- ZONE 1, ZONE 2, ZONE 3
- CONCEPCION
- CABATANGAN
- MATAB-ANG

### Severity Levels
- Critical (1) - Life-threatening emergencies
- High (2) - Urgent assistance needed
- Medium (3) - Standard response required
- Low (4) - Non-urgent situations
- Information (5) - Report only

## Performance Testing Guidelines

### Response Time Targets
- Page loads: < 3 seconds
- API responses: < 1 second
- Real-time updates: < 5 seconds
- Notification delivery: < 10 seconds

### Load Testing
- Test with multiple concurrent users
- Verify system stability under load
- Check database performance
- Monitor server resource usage

## Reporting and Documentation

### Test Execution Reports
- Document all test results
- Include screenshots for failed tests
- Record performance metrics
- Note any unexpected behavior

### Issue Tracking
- Log all issues found
- Include steps to reproduce
- Provide environment details
- Assign severity levels

## Continuous Integration

For automated CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
name: RVOIS Testing
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '22.21.0'
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm test
      - run: pnpm check:types
      - run: pnpm lint
      - run: pnpm build
```

## Best Practices

### Efficient Testing
1. **Parallel Execution**: Test different roles simultaneously
2. **Automated First**: Run automated tests before manual testing
3. **Document Everything**: Keep detailed records of test results
4. **Regular Testing**: Execute tests regularly during development

### Quality Assurance
1. **Cross-browser Testing**: Verify functionality across browsers
2. **Mobile Testing**: Test PWA features on mobile devices
3. **Security Testing**: Validate access controls and data privacy
4. **Performance Testing**: Monitor system performance metrics

## Troubleshooting Common Issues

### Server Won't Start
- Check environment variables
- Verify Supabase connection
- Review console error messages

### Tests Failing
- Ensure test accounts exist
- Check database connectivity
- Verify migrations are applied

### Performance Issues
- Monitor server resources
- Check database query performance
- Review network latency

## Conclusion

This testing framework provides a comprehensive approach to validating the RVOIS system. By combining automated and manual testing methods, you can efficiently ensure system quality and reliability.

Regular execution of these tests will help maintain system stability and identify potential issues before they affect users.