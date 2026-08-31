import type { Snapshot } from "@/lib/types";

/**
 * Seeded demo network. Read by the mock adapter only. Once the backend is
 * connected this stops being loaded at runtime and remains as fixture data for
 * local development and tests.
 */
export const SEED: Snapshot = {
  currentOperator: {
    name: "Platform operations",
    scope: "Rana54 production",
    permission: "Cross-tenant operations"
  },
  enterprises: [
    {
      id: "ENT-SHL-0018",
      name: "Sahel Foods Ltd.",
      region: "Nigeria",
      status: "Active",
      readiness: 92,
      adminName: "Amina Yusuf",
      adminEmail: "a••••@sahelfoods.ng",
      products: ["Energy workspace", "dMRV reports"],
      sites: 8,
      liveSites: 7,
      lastActivity: "12 min ago"
    },
    {
      id: "ENT-ARD-0074",
      name: "Ardent Manufacturing",
      region: "Nigeria",
      status: "Onboarding",
      readiness: 64,
      adminName: "Chidi Okeke",
      adminEmail: "c••••@ardentmfg.com",
      products: ["Energy workspace"],
      sites: 3,
      liveSites: 1,
      lastActivity: "1 hr ago"
    },
    {
      id: "ENT-NRB-0031",
      name: "Northbridge Retail",
      region: "Ghana",
      status: "Needs attention",
      readiness: 48,
      adminName: "Efua Mensah",
      adminEmail: "e••••@northbridge.com",
      products: ["Energy workspace", "dMRV reports"],
      sites: 5,
      liveSites: 3,
      lastActivity: "Yesterday"
    },
    {
      id: "ENT-KVL-0062",
      name: "Kavala Logistics",
      region: "Kenya",
      status: "Active",
      readiness: 88,
      adminName: "Njeri Kamau",
      adminEmail: "n••••@kavala.co.ke",
      products: ["Energy workspace"],
      sites: 4,
      liveSites: 4,
      lastActivity: "34 min ago"
    }
  ],
  siteRequests: [
    {
      id: "REQ-SITE-1028",
      enterpriseId: "ENT-ARD-0074",
      enterprise: "Ardent Manufacturing",
      siteName: "Apapa Assembly Plant",
      location: "Apapa, Lagos",
      requestedBy: "Chidi Okeke",
      submitted: "28 Aug, 09:14",
      status: "Pending review",
      functions: ["Grid import", "Solar generation", "Battery charge and discharge"]
    },
    {
      id: "REQ-SITE-1024",
      enterpriseId: "ENT-NRB-0031",
      enterprise: "Northbridge Retail",
      siteName: "Accra Distribution Centre",
      location: "Tema, Greater Accra",
      requestedBy: "Efua Mensah",
      submitted: "27 Aug, 16:32",
      status: "Pending review",
      functions: ["Grid import", "Solar generation"]
    },
    {
      id: "REQ-SITE-1019",
      enterpriseId: "ENT-SHL-0018",
      enterprise: "Sahel Foods Ltd.",
      siteName: "Kano Cold Store",
      location: "Kano, Kano",
      requestedBy: "Amina Yusuf",
      submitted: "25 Aug, 11:05",
      status: "Approved",
      functions: ["Grid import", "Solar generation", "Battery charge and discharge"]
    },
    {
      id: "REQ-SITE-1014",
      enterpriseId: "ENT-KVL-0062",
      enterprise: "Kavala Logistics",
      siteName: "Mombasa Transit Yard",
      location: "Mombasa, Coast",
      requestedBy: "Njeri Kamau",
      submitted: "22 Aug, 14:20",
      status: "Approved",
      functions: ["Grid import", "Solar generation"]
    }
  ],
  installers: [
    {
      id: "INS-LAG-0084",
      name: "David Adeyemi",
      region: "Lagos",
      certification: "Current",
      capacity: "2 slots",
      phone: "+234 ••• ••74",
      activeJobs: 2,
      status: "Available"
    },
    {
      id: "INS-KAN-0022",
      name: "Maryam Bello",
      region: "Kano",
      certification: "Current",
      capacity: "1 slot",
      phone: "+234 ••• ••18",
      activeJobs: 3,
      status: "On job"
    },
    {
      id: "INS-ABJ-0046",
      name: "Emeka Nwosu",
      region: "Abuja",
      certification: "Expires in 12 days",
      capacity: "3 slots",
      phone: "+234 ••• ••41",
      activeJobs: 1,
      status: "Available"
    },
    {
      id: "INS-ACC-0011",
      name: "Kojo Tetteh",
      region: "Greater Accra",
      certification: "Current",
      capacity: "2 slots",
      phone: "+233 ••• ••09",
      activeJobs: 2,
      status: "Available"
    }
  ],
  jobs: [
    {
      id: "JOB-2608-0412",
      enterpriseId: "ENT-SHL-0018",
      enterprise: "Sahel Foods Ltd.",
      siteRequestId: "REQ-SITE-1019",
      site: "Kano Cold Store",
      installerId: "INS-KAN-0022",
      installer: "Maryam Bello",
      status: "Ready for acceptance",
      scheduled: "28 Aug, 13:30",
      progress: 86,
      blockers: [],
      checklist: [
        "Owner confirmed",
        "Gateway linked",
        "Functions mapped",
        "Delivery test passed"
      ],
      linkedDevice: "GW-R54-KAN-7721"
    },
    {
      id: "JOB-2608-0416",
      enterpriseId: "ENT-ARD-0074",
      enterprise: "Ardent Manufacturing",
      siteRequestId: "REQ-SITE-1028",
      site: "Apapa Assembly Plant",
      installerId: "INS-LAG-0084",
      installer: "David Adeyemi",
      status: "Awaiting site approval",
      scheduled: "Not scheduled",
      progress: 12,
      blockers: ["Site request is awaiting approval"],
      checklist: ["Owner confirmed"],
      linkedDevice: null
    },
    {
      id: "JOB-2608-0398",
      enterpriseId: "ENT-NRB-0031",
      enterprise: "Northbridge Retail",
      siteRequestId: "REQ-SITE-1016",
      site: "Kumasi Flagship",
      installerId: "INS-ACC-0011",
      installer: "Kojo Tetteh",
      status: "Blocked",
      scheduled: "27 Aug, 10:00",
      progress: 44,
      blockers: ["Gateway serial conflicts with an existing identity"],
      checklist: ["Owner confirmed", "Gateway scanned"],
      linkedDevice: null
    },
    {
      id: "JOB-2608-0387",
      enterpriseId: "ENT-KVL-0062",
      enterprise: "Kavala Logistics",
      siteRequestId: "REQ-SITE-1008",
      site: "Nairobi Fleet Depot",
      installerId: "INS-ABJ-0046",
      installer: "Emeka Nwosu",
      status: "Completed",
      scheduled: "24 Aug, 09:00",
      progress: 100,
      blockers: [],
      checklist: [
        "Owner confirmed",
        "Gateway linked",
        "Functions mapped",
        "Delivery test passed",
        "Installation accepted"
      ],
      linkedDevice: "GW-R54-NBO-4118"
    }
  ],
  devices: [
    {
      id: "GW-R54-KAN-7721",
      serial: "R54G-94K2-7721",
      type: "Rana Gateway",
      enterprise: "Sahel Foods Ltd.",
      enterpriseId: "ENT-SHL-0018",
      site: "Kano Cold Store",
      status: "Testing",
      heartbeat: "38 sec ago",
      firmware: "4.8.2",
      jobId: "JOB-2608-0412",
      functions: [
        { name: "Grid import", source: "Measured", state: "Passing" },
        { name: "Solar generation", source: "Measured", state: "Passing" },
        { name: "Battery charge and discharge", source: "Measured", state: "Passing" }
      ],
      lastDiagnostic: "Delivery test passed at 12:48"
    },
    {
      id: "GW-R54-IKE-0472",
      serial: "R54G-31F8-0472",
      type: "Rana Gateway",
      enterprise: "Sahel Foods Ltd.",
      enterpriseId: "ENT-SHL-0018",
      site: "Ikeja Production Hub",
      status: "Live",
      heartbeat: "18 sec ago",
      firmware: "4.8.2",
      jobId: "JOB-2607-0314",
      functions: [
        { name: "Grid import and export", source: "Measured", state: "Passing" },
        { name: "Solar generation", source: "Measured", state: "Passing" },
        { name: "Battery charge and discharge", source: "Measured", state: "Passing" }
      ],
      lastDiagnostic: "Routine health check passed at 08:10"
    },
    {
      id: "GW-R54-KUM-2014",
      serial: "R54G-77Q1-2014",
      type: "Rana Gateway",
      enterprise: "Northbridge Retail",
      enterpriseId: "ENT-NRB-0031",
      site: "Kumasi Flagship",
      status: "Identity conflict",
      heartbeat: "No accepted heartbeat",
      firmware: "4.7.9",
      jobId: "JOB-2608-0398",
      functions: [
        { name: "Grid import", source: "Not linked", state: "Blocked" },
        { name: "Solar generation", source: "Not linked", state: "Blocked" }
      ],
      lastDiagnostic: "Duplicate serial detected at 10:42"
    },
    {
      id: "GW-R54-ACC-1182",
      serial: "R54G-18D4-1182",
      type: "Rana Gateway",
      enterprise: "Northbridge Retail",
      enterpriseId: "ENT-NRB-0031",
      site: "Accra Central Store",
      status: "Offline",
      heartbeat: "6 hr ago",
      firmware: "4.8.1",
      jobId: "JOB-2607-0291",
      functions: [
        { name: "Grid import", source: "Measured", state: "No recent data" },
        { name: "Solar generation", source: "Measured", state: "No recent data" }
      ],
      lastDiagnostic: "Heartbeat timeout confirmed at 05:59"
    },
    {
      id: "GW-R54-NBO-4118",
      serial: "R54G-55P6-4118",
      type: "Rana Gateway",
      enterprise: "Kavala Logistics",
      enterpriseId: "ENT-KVL-0062",
      site: "Nairobi Fleet Depot",
      status: "Live",
      heartbeat: "29 sec ago",
      firmware: "4.8.2",
      jobId: "JOB-2608-0387",
      functions: [
        { name: "Grid import", source: "Measured", state: "Passing" },
        { name: "Solar generation", source: "Measured", state: "Passing" }
      ],
      lastDiagnostic: "Routine health check passed at 08:04"
    }
  ],
  incidents: [
    {
      id: "INC-P1-2048",
      title: "Gateway offline at Accra Central Store",
      scope: "Device and data",
      enterprise: "Northbridge Retail",
      severity: "P1",
      status: "Open",
      owner: "Unassigned",
      age: "48 min",
      sla: "12 min to breach",
      deviceId: "GW-R54-ACC-1182",
      notes: ["Automated heartbeat threshold exceeded."]
    },
    {
      id: "INC-P2-2041",
      title: "Duplicate gateway identity blocks installation",
      scope: "Installation",
      enterprise: "Northbridge Retail",
      severity: "P2",
      status: "Acknowledged",
      owner: "Device operations",
      age: "2 hr",
      sla: "4 hr remaining",
      deviceId: "GW-R54-KUM-2014",
      notes: ["Installer preserved the original serial photo."]
    },
    {
      id: "INC-P2-2039",
      title: "Report generation queue delayed",
      scope: "Platform",
      enterprise: "Multiple tenants",
      severity: "P2",
      status: "Investigating",
      owner: "Platform operations",
      age: "3 hr",
      sla: "3 hr remaining",
      deviceId: null,
      notes: ["No report content has been lost."]
    },
    {
      id: "INC-P3-2028",
      title: "Installer certification expires soon",
      scope: "Field operations",
      enterprise: "Internal",
      severity: "P3",
      status: "Open",
      owner: "Field operations",
      age: "1 day",
      sla: "2 days remaining",
      deviceId: null,
      notes: ["Renewal reminder sent to assigned installer."]
    }
  ],
  staff: [
    {
      id: "STF-OPS-010",
      name: "Lami Abdullahi",
      email: "l••••@rana54.com",
      role: "Platform Operator",
      scope: "All tenants",
      status: "Active",
      lastAccess: "6 min ago",
      privileged: true
    },
    {
      id: "STF-FLD-014",
      name: "Tunde Cole",
      email: "t••••@rana54.com",
      role: "Field Operations",
      scope: "Nigeria",
      status: "Active",
      lastAccess: "42 min ago",
      privileged: false
    },
    {
      id: "STF-DAT-009",
      name: "Zainab Ibrahim",
      email: "z••••@rana54.com",
      role: "Data Operations",
      scope: "All tenants",
      status: "Active",
      lastAccess: "2 hr ago",
      privileged: true
    },
    {
      id: "STF-SUP-021",
      name: "Kwame Asare",
      email: "k••••@rana54.com",
      role: "Support Analyst",
      scope: "Assigned tenants",
      status: "Active",
      lastAccess: "Yesterday",
      privileged: false
    }
  ],
  supportGrants: [
    {
      id: "GRANT-0418",
      staff: "Kwame Asare",
      enterprise: "Northbridge Retail",
      mode: "Read only",
      expires: "Today, 18:00",
      reason: "Investigate offline gateway",
      status: "Active"
    },
    {
      id: "GRANT-0411",
      staff: "Tunde Cole",
      enterprise: "Sahel Foods Ltd.",
      mode: "Read only",
      expires: "27 Aug, 17:00",
      reason: "Verify site acceptance",
      status: "Expired"
    }
  ],
  services: [
    {
      id: "SVC-RANAOS",
      name: "RanaOS ingestion",
      status: "Operational",
      metric: "99.98%",
      detail: "Live ingestion across active tenants"
    },
    {
      id: "SVC-FIELD",
      name: "Installer sync",
      status: "Operational",
      metric: "99.95%",
      detail: "Field queues are processing normally"
    },
    {
      id: "SVC-NOTIFY",
      name: "Notifications",
      status: "Operational",
      metric: "99.99%",
      detail: "Email and in-app delivery normal"
    },
    {
      id: "SVC-REPORTS",
      name: "Report generation",
      status: "Degraded",
      metric: "96.40%",
      detail: "Large exports are delayed by up to 18 minutes"
    }
  ],
  audit: [
    {
      id: "AUD-8821",
      time: "28 Aug, 12:48",
      actor: "System",
      action: "Delivery test recorded",
      entity: "GW-R54-KAN-7721",
      outcome: "Passed",
      reason: "Commissioning evidence received"
    },
    {
      id: "AUD-8820",
      time: "28 Aug, 12:41",
      actor: "Lami Abdullahi",
      action: "Incident acknowledged",
      entity: "INC-P2-2041",
      outcome: "Recorded",
      reason: "Device operations assigned"
    },
    {
      id: "AUD-8819",
      time: "28 Aug, 11:57",
      actor: "Tunde Cole",
      action: "Installation returned",
      entity: "JOB-2608-0398",
      outcome: "Blocked",
      reason: "Duplicate gateway serial"
    },
    {
      id: "AUD-8818",
      time: "28 Aug, 10:12",
      actor: "System",
      action: "Support grant expired",
      entity: "GRANT-0411",
      outcome: "Access removed",
      reason: "Scheduled expiry"
    },
    {
      id: "AUD-8817",
      time: "28 Aug, 09:16",
      actor: "Zainab Ibrahim",
      action: "Site request opened",
      entity: "REQ-SITE-1028",
      outcome: "Pending review",
      reason: "New enterprise request"
    }
  ]
};
