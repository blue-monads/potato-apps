local M = {}

M.TABLE_GROUPS = {
    ["school-attendance"] = {
        id = "school-attendance",
        name = "Student & School Management",
        description = "Track students, subjects, daily attendance, and exam grades in one connected system",
        category = "Education",
        icon = "graduation-cap",
        color = "blue",
        tables = {
            {
                id = "students",
                name = "Students",
                description = "Student roster, enrollment details, and parent contact",
                icon = "user-graduate",
                color = "blue",
                columns = {
                    { name = "Full Name", column_type = "text", info = "Student's full name", required = true },
                    { name = "Roll Number", column_type = "text", info = "Unique student ID or roll number" },
                    { name = "Grade Class", column_type = "dropdown", info = "Class or grade level", options = "Grade 9, Grade 10, Grade 11, Grade 12" },
                    { name = "Email", column_type = "email", info = "Student or parent email" },
                    { name = "Date of Birth", column_type = "date", info = "Birthday" },
                    { name = "Status", column_type = "dropdown", info = "Enrollment status", options = "Active, Inactive, Graduated, Suspended" },
                },
                rows = {
                    { ["Full Name"] = "Alice Smith", ["Roll Number"] = "R-101", ["Grade Class"] = "Grade 10", ["Email"] = "alice.smith@school.edu", ["Date of Birth"] = "2009-04-12", ["Status"] = "Active" },
                    { ["Full Name"] = "Bob Johnson", ["Roll Number"] = "R-102", ["Grade Class"] = "Grade 10", ["Email"] = "bob.j@school.edu", ["Date of Birth"] = "2009-08-25", ["Status"] = "Active" },
                    { ["Full Name"] = "Charlie Brown", ["Roll Number"] = "R-103", ["Grade Class"] = "Grade 11", ["Email"] = "charlie.b@school.edu", ["Date of Birth"] = "2008-11-03", ["Status"] = "Active" },
                    { ["Full Name"] = "Diana Prince", ["Roll Number"] = "R-104", ["Grade Class"] = "Grade 11", ["Email"] = "diana.p@school.edu", ["Date of Birth"] = "2008-02-18", ["Status"] = "Active" }
                }
            },
            {
                id = "subjects",
                name = "Subjects",
                description = "Curriculum courses, subject codes, and assigned teachers",
                icon = "book-open",
                color = "indigo",
                columns = {
                    { name = "Subject Name", column_type = "text", info = "Course name", required = true },
                    { name = "Code", column_type = "text", info = "Subject identifier code" },
                    { name = "Department", column_type = "dropdown", info = "Academic department", options = "Mathematics, Science, Humanities, Arts, Languages" },
                    { name = "Teacher", column_type = "text", info = "Primary instructor" },
                    { name = "Credits", column_type = "number", info = "Credit hours" },
                },
                rows = {
                    { ["Subject Name"] = "Advanced Mathematics", ["Code"] = "MATH-201", ["Department"] = "Mathematics", ["Teacher"] = "Dr. Alan Turing", ["Credits"] = 4 },
                    { ["Subject Name"] = "General Physics", ["Code"] = "PHYS-101", ["Department"] = "Science", ["Teacher"] = "Prof. Marie Curie", ["Credits"] = 4 },
                    { ["Subject Name"] = "English Literature", ["Code"] = "ENG-105", ["Department"] = "Languages", ["Teacher"] = "Ms. Jane Austen", ["Credits"] = 3 },
                    { ["Subject Name"] = "World History", ["Code"] = "HIST-110", ["Department"] = "Humanities", ["Teacher"] = "Mr. Howard Zinn", ["Credits"] = 3 }
                }
            },
            {
                id = "attendance",
                name = "Attendance",
                description = "Daily student class attendance logs and status",
                icon = "clipboard-user",
                color = "emerald",
                columns = {
                    { name = "Student", column_type = "ref", info = "Enrolled student", target_group_table = "students", target_column = "name", required = true },
                    { name = "Subject", column_type = "ref", info = "Attended subject", target_group_table = "subjects", target_column = "name" },
                    { name = "Date", column_type = "date", info = "Date of session", required = true },
                    { name = "Status", column_type = "dropdown", info = "Attendance status", options = "Present, Absent, Late, Excused" },
                    { name = "Remarks", column_type = "text", info = "Notes or reason" },
                },
                rows = {
                    { ["Student"] = 1, ["Subject"] = 1, ["Date"] = "2026-09-21", ["Status"] = "Present", ["Remarks"] = "On time" },
                    { ["Student"] = 2, ["Subject"] = 1, ["Date"] = "2026-09-21", ["Status"] = "Late", ["Remarks"] = "Arrived 10 mins late" },
                    { ["Student"] = 3, ["Subject"] = 2, ["Date"] = "2026-09-21", ["Status"] = "Present", ["Remarks"] = "Lab completed" },
                    { ["Student"] = 4, ["Subject"] = 3, ["Date"] = "2026-09-22", ["Status"] = "Present", ["Remarks"] = "Active participant" },
                    { ["Student"] = 1, ["Subject"] = 2, ["Date"] = "2026-09-22", ["Status"] = "Excused", ["Remarks"] = "Doctor note provided" }
                }
            },
            {
                id = "grades",
                name = "Grades & Exams",
                description = "Term assessment scores, exam types, and final grades",
                icon = "award",
                color = "violet",
                columns = {
                    { name = "Student", column_type = "ref", info = "Student", target_group_table = "students", target_column = "name", required = true },
                    { name = "Subject", column_type = "ref", info = "Subject", target_group_table = "subjects", target_column = "name", required = true },
                    { name = "Exam Term", column_type = "dropdown", info = "Assessment cycle", options = "Midterm Exam, Final Exam, Quiz 1, Quiz 2, Project" },
                    { name = "Score", column_type = "number", info = "Obtained marks" },
                    { name = "Max Score", column_type = "number", info = "Total possible marks" },
                    { name = "Grade", column_type = "dropdown", info = "Letter grade", options = "A+, A, B+, B, C, D, F" },
                },
                rows = {
                    { ["Student"] = 1, ["Subject"] = 1, ["Exam Term"] = "Midterm Exam", ["Score"] = 96, ["Max Score"] = 100, ["Grade"] = "A+" },
                    { ["Student"] = 2, ["Subject"] = 1, ["Exam Term"] = "Midterm Exam", ["Score"] = 84, ["Max Score"] = 100, ["Grade"] = "B+" },
                    { ["Student"] = 3, ["Subject"] = 2, ["Exam Term"] = "Quiz 1", ["Score"] = 48, ["Max Score"] = 50, ["Grade"] = "A" },
                    { ["Student"] = 4, ["Subject"] = 3, ["Exam Term"] = "Project", ["Score"] = 91, ["Max Score"] = 100, ["Grade"] = "A-" },
                    { ["Student"] = 1, ["Subject"] = 4, ["Exam Term"] = "Midterm Exam", ["Score"] = 88, ["Max Score"] = 100, ["Grade"] = "B+" }
                }
            }
        }
    },
    ["ecommerce-orders"] = {
        id = "ecommerce-orders",
        name = "E-Commerce & Orders",
        description = "Manage product catalogs, customer accounts, orders, and line items",
        category = "Commerce",
        icon = "cart-shopping",
        color = "emerald",
        tables = {
            {
                id = "products",
                name = "Products",
                description = "Product inventory, pricing, and stock status",
                icon = "box",
                color = "emerald",
                columns = {
                    { name = "Product Name", column_type = "text", info = "Name of item", required = true },
                    { name = "SKU", column_type = "text", info = "Stock keeping unit" },
                    { name = "Category", column_type = "dropdown", info = "Product category", options = "Electronics, Apparel, Home & Kitchen, Health, Books" },
                    { name = "Unit Price", column_type = "number", info = "Price in USD" },
                    { name = "Stock Quantity", column_type = "number", info = "Current inventory count" },
                    { name = "Status", column_type = "dropdown", info = "Availability", options = "In Stock, Low Stock, Backordered, Discontinued" },
                },
                rows = {
                    { ["Product Name"] = "Noise-Canceling Wireless Headphones", ["SKU"] = "AUD-100", ["Category"] = "Electronics", ["Unit Price"] = 199.99, ["Stock Quantity"] = 45, ["Status"] = "In Stock" },
                    { ["Product Name"] = "Ergonomic Mechanical Keyboard", ["SKU"] = "KEY-200", ["Category"] = "Electronics", ["Unit Price"] = 129.50, ["Stock Quantity"] = 30, ["Status"] = "In Stock" },
                    { ["Product Name"] = "Organic Cotton Crewneck T-Shirt", ["SKU"] = "APP-300", ["Category"] = "Apparel", ["Unit Price"] = 29.99, ["Stock Quantity"] = 110, ["Status"] = "In Stock" },
                    { ["Product Name"] = "Ceramic Pour-Over Coffee Maker", ["SKU"] = "HOM-400", ["Category"] = "Home & Kitchen", ["Unit Price"] = 38.00, ["Stock Quantity"] = 18, ["Status"] = "Low Stock" }
                }
            },
            {
                id = "customers",
                name = "Customers",
                description = "Customer directory, contact information, and tiers",
                icon = "users",
                color = "blue",
                columns = {
                    { name = "Customer Name", column_type = "text", info = "Full name", required = true },
                    { name = "Email", column_type = "email", info = "Contact email" },
                    { name = "Phone", column_type = "text", info = "Phone number" },
                    { name = "City", column_type = "text", info = "Customer city" },
                    { name = "Tier", column_type = "dropdown", info = "Loyalty tier", options = "Standard, Silver, Gold, VIP" },
                },
                rows = {
                    { ["Customer Name"] = "Sarah Jenkins", ["Email"] = "sarah.j@example.com", ["Phone"] = "+1-555-0192", ["City"] = "Seattle", ["Tier"] = "Gold" },
                    { ["Customer Name"] = "Marcus Vance", ["Email"] = "marcus.v@example.com", ["Phone"] = "+1-555-0143", ["City"] = "Austin", ["Tier"] = "VIP" },
                    { ["Customer Name"] = "Elena Rostova", ["Email"] = "elena.r@example.com", ["Phone"] = "+1-555-0188", ["City"] = "New York", ["Tier"] = "Standard" }
                }
            },
            {
                id = "orders",
                name = "Orders",
                description = "Customer purchase orders, payment, and shipping status",
                icon = "receipt",
                color = "amber",
                columns = {
                    { name = "Order Number", column_type = "text", info = "Order ID #", required = true },
                    { name = "Customer", column_type = "ref", info = "Placing customer", target_group_table = "customers", target_column = "name", required = true },
                    { name = "Order Date", column_type = "date", info = "Date placed" },
                    { name = "Total Amount", column_type = "number", info = "Total order sum" },
                    { name = "Payment Status", column_type = "dropdown", info = "Payment status", options = "Pending, Paid, Refunded, Failed" },
                    { name = "Fulfillment", column_type = "dropdown", info = "Shipping status", options = "Unfulfilled, Processing, Shipped, Delivered, Returned" },
                },
                rows = {
                    { ["Order Number"] = "ORD-2026-001", ["Customer"] = 1, ["Order Date"] = "2026-09-18", ["Total Amount"] = 229.98, ["Payment Status"] = "Paid", ["Fulfillment"] = "Delivered" },
                    { ["Order Number"] = "ORD-2026-002", ["Customer"] = 2, ["Order Date"] = "2026-09-20", ["Total Amount"] = 129.50, ["Payment Status"] = "Paid", ["Fulfillment"] = "Shipped" },
                    { ["Order Number"] = "ORD-2026-003", ["Customer"] = 3, ["Order Date"] = "2026-09-23", ["Total Amount"] = 67.99, ["Payment Status"] = "Pending", ["Fulfillment"] = "Processing" }
                }
            },
            {
                id = "order-items",
                name = "Order Items",
                description = "Individual products and quantities tied to orders",
                icon = "list-check",
                color = "purple",
                columns = {
                    { name = "Order", column_type = "ref", info = "Related order", target_group_table = "orders", target_column = "name", required = true },
                    { name = "Product", column_type = "ref", info = "Ordered product", target_group_table = "products", target_column = "name", required = true },
                    { name = "Quantity", column_type = "number", info = "Item quantity", required = true },
                    { name = "Unit Price", column_type = "number", info = "Price per unit" },
                    { name = "Subtotal", column_type = "number", info = "Line total" },
                },
                rows = {
                    { ["Order"] = 1, ["Product"] = 1, ["Quantity"] = 1, ["Unit Price"] = 199.99, ["Subtotal"] = 199.99 },
                    { ["Order"] = 1, ["Product"] = 3, ["Quantity"] = 1, ["Unit Price"] = 29.99, ["Subtotal"] = 29.99 },
                    { ["Order"] = 2, ["Product"] = 2, ["Quantity"] = 1, ["Unit Price"] = 129.50, ["Subtotal"] = 129.50 },
                    { ["Order"] = 3, ["Product"] = 4, ["Quantity"] = 1, ["Unit Price"] = 38.00, ["Subtotal"] = 38.00 },
                    { ["Order"] = 3, ["Product"] = 3, ["Quantity"] = 1, ["Unit Price"] = 29.99, ["Subtotal"] = 29.99 }
                }
            }
        }
    },
    ["project-tasks"] = {
        id = "project-tasks",
        name = "Project Management & Sprints",
        description = "Coordinate team projects, milestones, tasks, and member assignments",
        category = "Productivity",
        icon = "kanban",
        color = "indigo",
        tables = {
            {
                id = "projects",
                name = "Projects",
                description = "Initiatives, timelines, and overall status",
                icon = "folder-tree",
                color = "indigo",
                columns = {
                    { name = "Project Name", column_type = "text", info = "Project title", required = true },
                    { name = "Key Code", column_type = "text", info = "Short code e.g. PRJ" },
                    { name = "Status", column_type = "dropdown", info = "Lifecycle status", options = "Planning, In Progress, On Hold, Completed" },
                    { name = "Start Date", column_type = "date", info = "Project kickoff" },
                    { name = "Target Date", column_type = "date", info = "Target completion" },
                    { name = "Budget", column_type = "number", info = "Allocated budget" },
                },
                rows = {
                    { ["Project Name"] = "Mobile App Redesign v2", ["Key Code"] = "MAR", ["Status"] = "In Progress", ["Start Date"] = "2026-08-01", ["Target Date"] = "2026-11-30", ["Budget"] = 75000 },
                    { ["Project Name"] = "Infrastructure Cloud Migration", ["Key Code"] = "ICM", ["Status"] = "In Progress", ["Start Date"] = "2026-07-15", ["Target Date"] = "2026-10-15", ["Budget"] = 120000 },
                    { ["Project Name"] = "Design System & UI Kit", ["Key Code"] = "DSK", ["Status"] = "Completed", ["Start Date"] = "2026-05-01", ["Target Date"] = "2026-08-31", ["Budget"] = 40000 }
                }
            },
            {
                id = "team-members",
                name = "Team Members",
                description = "Team roster, departments, and roles",
                icon = "user-group",
                color = "cyan",
                columns = {
                    { name = "Member Name", column_type = "text", info = "Full name", required = true },
                    { name = "Role", column_type = "text", info = "Job title" },
                    { name = "Department", column_type = "dropdown", info = "Department", options = "Engineering, Product, Design, QA, Marketing" },
                    { name = "Email", column_type = "email", info = "Work email" },
                },
                rows = {
                    { ["Member Name"] = "Alex Rivera", ["Role"] = "Lead Architect", ["Department"] = "Engineering", ["Email"] = "alex.r@company.io" },
                    { ["Member Name"] = "Priya Patel", ["Role"] = "Senior Product Manager", ["Department"] = "Product", ["Email"] = "priya.p@company.io" },
                    { ["Member Name"] = "Chen Wei", ["Role"] = "Lead UI/UX Designer", ["Department"] = "Design", ["Email"] = "chen.w@company.io" },
                    { ["Member Name"] = "Maya Lin", ["Role"] = "Full Stack Engineer", ["Department"] = "Engineering", ["Email"] = "maya.l@company.io" }
                }
            },
            {
                id = "milestones",
                name = "Milestones",
                description = "Key project deliverables and deadlines",
                icon = "flag-checkered",
                color = "rose",
                columns = {
                    { name = "Milestone", column_type = "text", info = "Milestone title", required = true },
                    { name = "Project", column_type = "ref", info = "Belongs to project", target_group_table = "projects", target_column = "name", required = true },
                    { name = "Due Date", column_type = "date", info = "Target due date" },
                    { name = "Status", column_type = "dropdown", info = "Status", options = "Not Started, On Track, At Risk, Achieved" },
                },
                rows = {
                    { ["Milestone"] = "User Testing & Wireframe Approval", ["Project"] = 1, ["Due Date"] = "2026-09-15", ["Status"] = "Achieved" },
                    { ["Milestone"] = "Core Database Cluster Migration", ["Project"] = 2, ["Due Date"] = "2026-09-30", ["Status"] = "On Track" },
                    { ["Milestone"] = "React Native Beta Release", ["Project"] = 1, ["Due Date"] = "2026-10-25", ["Status"] = "On Track" },
                    { ["Milestone"] = "Figma Component Library Publish", ["Project"] = 3, ["Due Date"] = "2026-08-20", ["Status"] = "Achieved" }
                }
            },
            {
                id = "tasks",
                name = "Tasks",
                description = "Actionable tasks with assignees and priority",
                icon = "list-check",
                color = "emerald",
                columns = {
                    { name = "Task Title", column_type = "text", info = "Task description", required = true },
                    { name = "Project", column_type = "ref", info = "Project", target_group_table = "projects", target_column = "name" },
                    { name = "Assignee", column_type = "ref", info = "Assigned team member", target_group_table = "team-members", target_column = "name" },
                    { name = "Status", column_type = "dropdown", info = "Progress state", options = "Backlog, Todo, In Progress, In Review, Done" },
                    { name = "Priority", column_type = "dropdown", info = "Urgency", options = "Low, Medium, High, Urgent" },
                    { name = "Due Date", column_type = "date", info = "Due date" },
                },
                rows = {
                    { ["Task Title"] = "Implement Biometric Auth Flow", ["Project"] = 1, ["Assignee"] = 4, ["Status"] = "In Progress", ["Priority"] = "High", ["Due Date"] = "2026-10-05" },
                    { ["Task Title"] = "Terraform Script Setup for VPC", ["Project"] = 2, ["Assignee"] = 1, ["Status"] = "Done", ["Priority"] = "Urgent", ["Due Date"] = "2026-09-20" },
                    { ["Task Title"] = "Review Mobile Checkout UX", ["Project"] = 1, ["Assignee"] = 2, ["Status"] = "In Review", ["Priority"] = "Medium", ["Due Date"] = "2026-09-28" },
                    { ["Task Title"] = "Design Accessible Color Palette", ["Project"] = 3, ["Assignee"] = 3, ["Status"] = "Done", ["Priority"] = "Medium", ["Due Date"] = "2026-08-15" },
                    { ["Task Title"] = "Load Testing on Staging Cluster", ["Project"] = 2, ["Assignee"] = 4, ["Status"] = "Todo", ["Priority"] = "High", ["Due Date"] = "2026-10-10" }
                }
            }
        }
    },
    ["crm-pipeline"] = {
        id = "crm-pipeline",
        name = "CRM & Sales Pipeline",
        description = "Track company accounts, sales leads, deals, and engagement activities",
        category = "Sales",
        icon = "handshake",
        color = "violet",
        tables = {
            {
                id = "accounts",
                name = "Accounts",
                description = "Target companies and corporate clients",
                icon = "building",
                color = "violet",
                columns = {
                    { name = "Company Name", column_type = "text", info = "Organization name", required = true },
                    { name = "Industry", column_type = "dropdown", info = "Industry sector", options = "SaaS & Tech, Healthcare, Finance, Retail, Manufacturing" },
                    { name = "Website", column_type = "link", info = "Company website" },
                    { name = "Annual Revenue", column_type = "number", info = "Estimated revenue" },
                    { name = "Location", column_type = "text", info = "Headquarters city" },
                },
                rows = {
                    { ["Company Name"] = "Apex Cloud Services", ["Industry"] = "SaaS & Tech", ["Website"] = "https://apexcloud.example", ["Annual Revenue"] = 15000000, ["Location"] = "San Francisco" },
                    { ["Company Name"] = "BioGen Health Systems", ["Industry"] = "Healthcare", ["Website"] = "https://biogen.example", ["Annual Revenue"] = 42000000, ["Location"] = "Boston" },
                    { ["Company Name"] = "Nordic Retail Holdings", ["Industry"] = "Retail", ["Website"] = "https://nordicretail.example", ["Annual Revenue"] = 28000000, ["Location"] = "Chicago" }
                }
            },
            {
                id = "contacts",
                name = "Contacts",
                description = "Stakeholders and decision makers at client accounts",
                icon = "address-card",
                color = "blue",
                columns = {
                    { name = "Contact Name", column_type = "text", info = "Person's name", required = true },
                    { name = "Company", column_type = "ref", info = "Associated company", target_group_table = "accounts", target_column = "name" },
                    { name = "Job Title", column_type = "text", info = "Position" },
                    { name = "Email", column_type = "email", info = "Direct email" },
                    { name = "Phone", column_type = "text", info = "Direct phone" },
                    { name = "Stage", column_type = "dropdown", info = "Contact status", options = "Lead, Prospect, Customer, Churned" },
                },
                rows = {
                    { ["Contact Name"] = "Liam Vance", ["Company"] = 1, ["Job Title"] = "VP of Engineering", ["Email"] = "lvance@apexcloud.example", ["Phone"] = "+1-415-555-0182", ["Stage"] = "Customer" },
                    { ["Contact Name"] = "Dr. Evelyn Ross", ["Company"] = 2, ["Job Title"] = "Chief Medical Officer", ["Email"] = "eross@biogen.example", ["Phone"] = "+1-617-555-0144", ["Stage"] = "Prospect" },
                    { ["Contact Name"] = "Henrik Lindqvist", ["Company"] = 3, ["Job Title"] = "Director of Supply Chain", ["Email"] = "henrik@nordicretail.example", ["Phone"] = "+1-312-555-0199", ["Stage"] = "Lead" },
                    { ["Contact Name"] = "Clara Oswald", ["Company"] = 1, ["Job Title"] = "Procurement Manager", ["Email"] = "coswald@apexcloud.example", ["Phone"] = "+1-415-555-0128", ["Stage"] = "Customer" }
                }
            },
            {
                id = "deals",
                name = "Deals Pipeline",
                description = "Sales opportunities, deal stages, and expected revenue",
                icon = "funnel-dollar",
                color = "emerald",
                columns = {
                    { name = "Deal Name", column_type = "text", info = "Opportunity title", required = true },
                    { name = "Account", column_type = "ref", info = "Client company", target_group_table = "accounts", target_column = "name" },
                    { name = "Value", column_type = "number", info = "Contract value" },
                    { name = "Stage", column_type = "dropdown", info = "Sales stage", options = "Prospecting, Qualification, Proposal Sent, Negotiation, Closed Won, Closed Lost" },
                    { name = "Target Close", column_type = "date", info = "Target close date" },
                },
                rows = {
                    { ["Deal Name"] = "Apex Enterprise Platform License", ["Account"] = 1, ["Value"] = 85000, ["Stage"] = "Closed Won", ["Target Close"] = "2026-08-30" },
                    { ["Deal Name"] = "BioGen HIPAA Compliance Suite", ["Account"] = 2, ["Value"] = 140000, ["Stage"] = "Proposal Sent", ["Target Close"] = "2026-10-15" },
                    { ["Deal Name"] = "Nordic POS Data Integration", ["Account"] = 3, ["Value"] = 65000, ["Stage"] = "Qualification", ["Target Close"] = "2026-11-01" }
                }
            },
            {
                id = "activities",
                name = "Sales Activities",
                description = "Calls, demos, emails, and meetings logged with clients",
                icon = "phone-volume",
                color = "amber",
                columns = {
                    { name = "Deal", column_type = "ref", info = "Related deal", target_group_table = "deals", target_column = "name" },
                    { name = "Activity Type", column_type = "dropdown", info = "Type of touchpoint", options = "Call, Discovery Meeting, Product Demo, Email Followup, Lunch" },
                    { name = "Date", column_type = "date", info = "Date of activity", required= true },
                    { name = "Summary Notes", column_type = "textarea", info = "Key takeaways" },
                },
                rows = {
                    { ["Deal"] = 1, ["Activity Type"] = "Call", ["Date"] = "2026-08-15", ["Summary Notes"] = "Reviewed security architecture and finalized license terms with Liam." },
                    { ["Deal"] = 2, ["Activity Type"] = "Product Demo", ["Date"] = "2026-09-12", ["Summary Notes"] = "Walkthrough of audit log compliance with Dr. Ross and security team." },
                    { ["Deal"] = 2, ["Activity Type"] = "Discovery Meeting", ["Date"] = "2026-09-20", ["Summary Notes"] = "Discussed data residency requirements and custom API connectors." },
                    { ["Deal"] = 3, ["Activity Type"] = "Discovery Meeting", ["Date"] = "2026-09-24", ["Summary Notes"] = "Initial intro with Henrik on inventory sync requirements." }
                }
            }
        }
    },
    ["hr-directory"] = {
        id = "hr-directory",
        name = "HR & Employee Directory",
        description = "Manage staff directory, department structures, leave requests, and performance",
        category = "HR",
        icon = "id-badge",
        color = "teal",
        tables = {
            {
                id = "departments",
                name = "Departments",
                description = "Organizational units and department heads",
                icon = "sitemap",
                color = "teal",
                columns = {
                    { name = "Department Name", column_type = "text", info = "Department name", required = true },
                    { name = "Department Head", column_type = "text", info = "Leader name" },
                    { name = "Budget", column_type = "number", info = "Annual budget" },
                    { name = "Office Floor", column_type = "text", info = "Location" },
                },
                rows = {
                    { ["Department Name"] = "Core Engineering", ["Department Head"] = "David Miller", ["Budget"] = 950000, ["Office Floor"] = "Floor 4" },
                    { ["Department Name"] = "Product Management", ["Department Head"] = "Sarah Chen", ["Budget"] = 420000, ["Office Floor"] = "Floor 3" },
                    { ["Department Name"] = "People Operations", ["Department Head"] = "Jessica Morales", ["Budget"] = 310000, ["Office Floor"] = "Floor 2" }
                }
            },
            {
                id = "employees",
                name = "Employees",
                description = "Staff roster, employee IDs, and employment details",
                icon = "user-tie",
                color = "blue",
                columns = {
                    { name = "Full Name", column_type = "text", info = "Employee name", required = true },
                    { name = "Employee ID", column_type = "text", info = "Work ID number" },
                    { name = "Department", column_type = "ref", info = "Assigned department", target_group_table = "departments", target_column = "name" },
                    { name = "Job Title", column_type = "text", info = "Official designation" },
                    { name = "Work Email", column_type = "email", info = "Work email" },
                    { name = "Employment Type", column_type = "dropdown", info = "Contract type", options = "Full-Time, Part-Time, Contractor, Intern" },
                    { name = "Join Date", column_type = "date", info = "Hire date" },
                },
                rows = {
                    { ["Full Name"] = "David Miller", ["Employee ID"] = "EMP-001", ["Department"] = 1, ["Job Title"] = "Director of Engineering", ["Work Email"] = "david.m@corp.local", ["Employment Type"] = "Full-Time", ["Join Date"] = "2023-03-01" },
                    { ["Full Name"] = "Sarah Chen", ["Employee ID"] = "EMP-002", ["Department"] = 2, ["Job Title"] = "Head of Product", ["Work Email"] = "sarah.c@corp.local", ["Employment Type"] = "Full-Time", ["Join Date"] = "2023-06-15" },
                    { ["Full Name"] = "Marcus Brody", ["Employee ID"] = "EMP-003", ["Department"] = 1, ["Job Title"] = "Senior Backend Developer", ["Work Email"] = "marcus.b@corp.local", ["Employment Type"] = "Full-Time", ["Join Date"] = "2024-01-10" },
                    { ["Full Name"] = "Jessica Morales", ["Employee ID"] = "EMP-004", ["Department"] = 3, ["Job Title"] = "HR Manager", ["Work Email"] = "jessica.m@corp.local", ["Employment Type"] = "Full-Time", ["Join Date"] = "2023-08-01" }
                }
            },
            {
                id = "leave-requests",
                name = "Leave Requests",
                description = "Time-off submissions, approvals, and vacation tracking",
                icon = "calendar-check",
                color = "amber",
                columns = {
                    { name = "Employee", column_type = "ref", info = "Requesting employee", target_group_table = "employees", target_column = "name", required = true },
                    { name = "Leave Type", column_type = "dropdown", info = "Category", options = "Paid Vacation, Sick Leave, Personal Day, Parental Leave, Unpaid" },
                    { name = "Start Date", column_type = "date", info = "First day off", required = true },
                    { name = "End Date", column_type = "date", info = "Last day off" },
                    { name = "Status", column_type = "dropdown", info = "Approval status", options = "Submitted, Approved, Rejected, Cancelled" },
                },
                rows = {
                    { ["Employee"] = 3, ["Leave Type"] = "Paid Vacation", ["Start Date"] = "2026-10-12", ["End Date"] = "2026-10-16", ["Status"] = "Approved" },
                    { ["Employee"] = 2, ["Leave Type"] = "Personal Day", ["Start Date"] = "2026-09-25", ["End Date"] = "2026-09-25", ["Status"] = "Approved" },
                    { ["Employee"] = 1, ["Leave Type"] = "Sick Leave", ["Start Date"] = "2026-09-10", ["End Date"] = "2026-09-11", ["Status"] = "Approved" },
                    { ["Employee"] = 3, ["Leave Type"] = "Paid Vacation", ["Start Date"] = "2026-12-24", ["End Date"] = "2026-12-31", ["Status"] = "Submitted" }
                }
            },
            {
                id = "reviews",
                name = "Performance Reviews",
                description = "Periodic evaluations, feedback, and rating scorecards",
                icon = "star",
                color = "purple",
                columns = {
                    { name = "Employee", column_type = "ref", info = "Reviewed employee", target_group_table = "employees", target_column = "name", required = true },
                    { name = "Review Cycle", column_type = "dropdown", info = "Cycle period", options = "Q1 Review, Q2 Review, Q3 Review, Q4 Review, Annual Review" },
                    { name = "Rating", column_type = "rating", info = "Score 1-5" },
                    { name = "Reviewer", column_type = "text", info = "Manager conducting review" },
                    { name = "Key Strengths", column_type = "textarea", info = "Notable strengths" },
                },
                rows = {
                    { ["Employee"] = 3, ["Review Cycle"] = "Q2 Review", ["Rating"] = 5, ["Reviewer"] = "David Miller", ["Key Strengths"] = "Architected real-time notification engine with zero downtime." },
                    { ["Employee"] = 2, ["Review Cycle"] = "Q2 Review", ["Rating"] = 4, ["Reviewer"] = "Executive Team", ["Key Strengths"] = "Strong leadership during mobile launch and clear sprint roadmaps." },
                    { ["Employee"] = 1, ["Review Cycle"] = "Annual Review", ["Rating"] = 5, ["Reviewer"] = "VP Technology", ["Key Strengths"] = "Exceptional team scaling and mentoring junior engineers." }
                }
            }
        }
    },
    ["events-conference"] = {
        id = "events-conference",
        name = "Event & Conference Planning",
        description = "Coordinate event agendas, guest speakers, sessions, and ticket registrations",
        category = "Events",
        icon = "calendar-days",
        color = "rose",
        tables = {
            {
                id = "events",
                name = "Events",
                description = "Conferences, summits, and venue details",
                icon = "landmark",
                color = "rose",
                columns = {
                    { name = "Event Title", column_type = "text", info = "Official event name", required = true },
                    { name = "Event Type", column_type = "dropdown", info = "Format", options = "In-Person Conference, Virtual Summit, Workshop, Gala Dinner" },
                    { name = "Start Date", column_type = "date", info = "Opening date" },
                    { name = "End Date", column_type = "date", info = "Closing date" },
                    { name = "Venue", column_type = "text", info = "Location or platform" },
                    { name = "Capacity", column_type = "number", info = "Max attendees" },
                },
                rows = {
                    { ["Event Title"] = "Global Tech Summit 2026", ["Event Type"] = "In-Person Conference", ["Start Date"] = "2026-11-10", ["End Date"] = "2026-11-12", ["Venue"] = "Metropolitan Convention Center", ["Capacity"] = 1500 },
                    { ["Event Title"] = "AI Developers Forum", ["Event Type"] = "Virtual Summit", ["Start Date"] = "2026-12-05", ["End Date"] = "2026-12-06", ["Venue"] = "Online Virtual Stage", ["Capacity"] = 3000 }
                }
            },
            {
                id = "speakers",
                name = "Speakers",
                description = "Keynote and session presenters directory",
                icon = "bullhorn",
                color = "violet",
                columns = {
                    { name = "Speaker Name", column_type = "text", info = "Presenter name", required = true },
                    { name = "Organization", column_type = "text", info = "Affiliated company" },
                    { name = "Bio", column_type = "textarea", info = "Short biography" },
                    { name = "Email", column_type = "email", info = "Contact email" },
                },
                rows = {
                    { ["Speaker Name"] = "Dr. Aris Thorne", ["Organization"] = "Deep Learning Labs", ["Bio"] = "Pioneer in distributed inference systems.", ["Email"] = "aris@example.com" },
                    { ["Speaker Name"] = "Linda Zhao", ["Organization"] = "HyperScale Cloud", ["Bio"] = "VP of Cloud Architecture and Kubernetes contributor.", ["Email"] = "lzhao@example.com" },
                    { ["Speaker Name"] = "David Kim", ["Organization"] = "NextGen Robotics", ["Bio"] = "Autonomous edge robotics lead engineer.", ["Email"] = "dkim@example.com" }
                }
            },
            {
                id = "sessions",
                name = "Sessions Agenda",
                description = "Scheduled talks, workshops, and breakout panels",
                icon = "clock",
                color = "blue",
                columns = {
                    { name = "Session Title", column_type = "text", info = "Talk title", required = true },
                    { name = "Event", column_type = "ref", info = "Belongs to event", target_group_table = "events", target_column = "name", required = true },
                    { name = "Speaker", column_type = "ref", info = "Speaker", target_group_table = "speakers", target_column = "name" },
                    { name = "Start Time", column_type = "time", info = "Session start" },
                    { name = "Room", column_type = "text", info = "Hall / Room" },
                },
                rows = {
                    { ["Session Title"] = "Opening Keynote: Distributed AI Horizons", ["Event"] = 1, ["Speaker"] = 1, ["Start Time"] = "09:30", ["Room"] = "Grand Ballroom" },
                    { ["Session Title"] = "Zero Downtime Cloud Migrations", ["Event"] = 1, ["Speaker"] = 2, ["Start Time"] = "11:15", ["Room"] = "Tech Hall A" },
                    { ["Session Title"] = "Edge Robotics & Real-time Vision", ["Event"] = 2, ["Speaker"] = 3, ["Start Time"] = "14:00", ["Room"] = "Virtual Track 1" }
                }
            },
            {
                id = "registrations",
                name = "Attendee Registrations",
                description = "Ticket orders and attendee check-in status",
                icon = "ticket",
                color = "emerald",
                columns = {
                    { name = "Attendee Name", column_type = "text", info = "Guest name", required = true },
                    { name = "Event", column_type = "ref", info = "Registered event", target_group_table = "events", target_column = "name", required = true },
                    { name = "Ticket Tier", column_type = "dropdown", info = "Pass type", options = "General Admission, VIP Pass, Early Bird, Student" },
                    { name = "Email", column_type = "email", info = "Ticket confirmation email" },
                    { name = "Checked In", column_type = "checkbox", info = "Badge printed / scanned" },
                },
                rows = {
                    { ["Attendee Name"] = "Jonathan Miller", ["Event"] = 1, ["Ticket Tier"] = "VIP Pass", ["Email"] = "jmiller@techcorp.com", ["Checked In"] = true },
                    { ["Attendee Name"] = "Sofia Rossi", ["Event"] = 1, ["Ticket Tier"] = "General Admission", ["Email"] = "srossi@startup.io", ["Checked In"] = false },
                    { ["Attendee Name"] = "Kenji Sato", ["Event"] = 2, ["Ticket Tier"] = "Early Bird", ["Email"] = "kenji@research.org", ["Checked In"] = true }
                }
            }
        }
    },
    ["restaurant-orders"] = {
        id = "restaurant-orders",
        name = "Restaurant & Table Bookings",
        description = "Menu catalog, table reservations, and live dining orders",
        category = "Hospitality",
        icon = "utensils",
        color = "amber",
        tables = {
            {
                id = "menu-items",
                name = "Menu Items",
                description = "Dishes, drinks, pricing, and allergen details",
                icon = "bowl-food",
                color = "amber",
                columns = {
                    { name = "Dish Name", column_type = "text", info = "Item name", required = true },
                    { name = "Category", column_type = "dropdown", info = "Course category", options = "Appetizers, Mains, Desserts, Cocktails, Non-Alcoholic" },
                    { name = "Price", column_type = "number", info = "Menu price" },
                    { name = "Dietary", column_type = "multiselect", info = "Dietary badges", options = "Vegetarian, Vegan, Gluten-Free, Nut-Free, Halal" },
                    { name = "Available", column_type = "checkbox", info = "In kitchen stock" },
                },
                rows = {
                    { ["Dish Name"] = "Truffle Mushroom Risotto", ["Category"] = "Mains", ["Price"] = 26.50, ["Dietary"] = "Vegetarian, Gluten-Free", ["Available"] = true },
                    { ["Dish Name"] = "Grilled Prime Ribeye (12oz)", ["Category"] = "Mains", ["Price"] = 42.00, ["Dietary"] = "Gluten-Free, Halal", ["Available"] = true },
                    { ["Dish Name"] = "Crispy Calamari Fritti", ["Category"] = "Appetizers", ["Price"] = 16.00, ["Dietary"] = "Nut-Free", ["Available"] = true },
                    { ["Dish Name"] = "Matcha Lava Cake", ["Category"] = "Desserts", ["Price"] = 12.00, ["Dietary"] = "Vegetarian", ["Available"] = true },
                    { ["Dish Name"] = "Smoked Rosemary Old Fashioned", ["Category"] = "Cocktails", ["Price"] = 15.00, ["Dietary"] = "Vegan", ["Available"] = true }
                }
            },
            {
                id = "reservations",
                name = "Table Reservations",
                description = "Guest bookings, party sizes, and scheduled times",
                icon = "calendar-check",
                color = "rose",
                columns = {
                    { name = "Guest Name", column_type = "text", info = "Primary diner", required = true },
                    { name = "Party Size", column_type = "number", info = "Number of guests", required = true },
                    { name = "Reservation Date", column_type = "date", info = "Date" },
                    { name = "Seating Time", column_type = "time", info = "Reservation time" },
                    { name = "Table Number", column_type = "number", info = "Assigned table" },
                    { name = "Status", column_type = "dropdown", info = "Booking state", options = "Confirmed, Seated, Completed, Cancelled, No-Show" },
                },
                rows = {
                    { ["Guest Name"] = "James Peterson", ["Party Size"] = 4, ["Reservation Date"] = "2026-09-28", ["Seating Time"] = "19:00", ["Table Number"] = 5, ["Status"] = "Completed" },
                    { ["Guest Name"] = "Sophia Laurent", ["Party Size"] = 2, ["Reservation Date"] = "2026-09-28", ["Seating Time"] = "20:30", ["Table Number"] = 12, ["Status"] = "Seated" },
                    { ["Guest Name"] = "Liam O'Connor", ["Party Size"] = 6, ["Reservation Date"] = "2026-09-29", ["Seating Time"] = "18:30", ["Table Number"] = 8, ["Status"] = "Confirmed" }
                }
            },
            {
                id = "kitchen-orders",
                name = "Dining Orders",
                description = "Tickets sent to kitchen and table billing",
                icon = "receipt",
                color = "blue",
                columns = {
                    { name = "Reservation", column_type = "ref", info = "Table booking", target_group_table = "reservations", target_column = "name" },
                    { name = "Server", column_type = "text", info = "Assigned server" },
                    { name = "Ordered Dish", column_type = "ref", info = "Menu item", target_group_table = "menu-items", target_column = "name" },
                    { name = "Quantity", column_type = "number", info = "Serving count" },
                    { name = "Order Status", column_type = "dropdown", info = "Preparation status", options = "Received, Cooking, Plated, Served, Paid" },
                },
                rows = {
                    { ["Reservation"] = 1, ["Server"] = "Marco", ["Ordered Dish"] = 1, ["Quantity"] = 2, ["Order Status"] = "Paid" },
                    { ["Reservation"] = 1, ["Server"] = "Marco", ["Ordered Dish"] = 5, ["Quantity"] = 4, ["Order Status"] = "Paid" },
                    { ["Reservation"] = 2, ["Server"] = "Chloe", ["Ordered Dish"] = 2, ["Quantity"] = 2, ["Order Status"] = "Cooking" },
                    { ["Reservation"] = 2, ["Server"] = "Chloe", ["Ordered Dish"] = 4, ["Quantity"] = 1, ["Order Status"] = "Received" }
                }
            }
        }
    },
    ["warehouse-inventory"] = {
        id = "warehouse-inventory",
        name = "Warehouse & Logistics",
        description = "Multi-warehouse stock levels, SKU items, and internal transfer manifests",
        category = "Operations",
        icon = "warehouse",
        color = "orange",
        tables = {
            {
                id = "items",
                name = "Inventory Items",
                description = "Physical items, barcodes, and master specifications",
                icon = "barcode",
                color = "orange",
                columns = {
                    { name = "Item Name", column_type = "text", info = "Product title", required = true },
                    { name = "Barcode", column_type = "barcode", info = "Scannable barcode" },
                    { name = "SKU", column_type = "text", info = "Inventory code" },
                    { name = "Category", column_type = "dropdown", info = "Type", options = "Raw Materials, Finished Goods, Packaging, Spare Parts" },
                    { name = "Unit of Measure", column_type = "dropdown", info = "UOM", options = "Pieces, Boxes, Kilograms, Liters, Pallets" },
                },
                rows = {
                    { ["Item Name"] = "M8 Stainless Steel Fasteners", ["Barcode"] = "890123450001", ["SKU"] = "FAST-M8-SS", ["Category"] = "Spare Parts", ["Unit of Measure"] = "Boxes" },
                    { ["Item Name"] = "Lithium Battery Module 48V", ["Barcode"] = "890123450002", ["SKU"] = "BAT-48V-5K", ["Category"] = "Finished Goods", ["Unit of Measure"] = "Pieces" },
                    { ["Item Name"] = "Reinforced Shipping Cartons (XL)", ["Barcode"] = "890123450003", ["SKU"] = "PKG-BOX-XL", ["Category"] = "Packaging", ["Unit of Measure"] = "Pallets" },
                    { ["Item Name"] = "Optical Temperature Sensor", ["Barcode"] = "890123450004", ["SKU"] = "SNS-OPT-01", ["Category"] = "Raw Materials", ["Unit of Measure"] = "Pieces" }
                }
            },
            {
                id = "warehouses",
                name = "Warehouses",
                description = "Storage facilities, distribution centers, and managers",
                icon = "building-shield",
                color = "slate",
                columns = {
                    { name = "Facility Name", column_type = "text", info = "Warehouse name", required = true },
                    { name = "Facility Code", column_type = "text", info = "Code e.g. WH-EAST" },
                    { name = "City", column_type = "text", info = "Location city" },
                    { name = "Manager", column_type = "text", info = "Facility supervisor" },
                },
                rows = {
                    { ["Facility Name"] = "Central Logistics Hub", ["Facility Code"] = "WH-CENTRAL", ["City"] = "Dallas", ["Manager"] = "Arthur Pendelton" },
                    { ["Facility Name"] = "West Coast Fulfillment", ["Facility Code"] = "WH-WEST", ["City"] = "Reno", ["Manager"] = "Evelyn Wu" },
                    { ["Facility Name"] = "East Harbor Depot", ["Facility Code"] = "WH-EAST", ["City"] = "Newark", ["Manager"] = "Carlos Santos" }
                }
            },
            {
                id = "stock-levels",
                name = "Stock Levels",
                description = "Current on-hand stock and reorder thresholds per warehouse",
                icon = "boxes-stacked",
                color = "emerald",
                columns = {
                    { name = "Item", column_type = "ref", info = "Inventory item", target_group_table = "items", target_column = "name", required = true },
                    { name = "Warehouse", column_type = "ref", info = "Storage site", target_group_table = "warehouses", target_column = "name", required = true },
                    { name = "Quantity On Hand", column_type = "number", info = "Current stock" },
                    { name = "Reorder Point", column_type = "number", info = "Restock trigger quantity" },
                },
                rows = {
                    { ["Item"] = 1, ["Warehouse"] = 1, ["Quantity On Hand"] = 450, ["Reorder Point"] = 100 },
                    { ["Item"] = 2, ["Warehouse"] = 1, ["Quantity On Hand"] = 65, ["Reorder Point"] = 20 },
                    { ["Item"] = 2, ["Warehouse"] = 2, ["Quantity On Hand"] = 40, ["Reorder Point"] = 15 },
                    { ["Item"] = 4, ["Warehouse"] = 3, ["Quantity On Hand"] = 180, ["Reorder Point"] = 50 }
                }
            },
            {
                id = "transfers",
                name = "Stock Transfers",
                description = "Inter-facility transfer shipments and movement logs",
                icon = "truck-ramp-box",
                color = "blue",
                columns = {
                    { name = "Transfer Code", column_type = "text", info = "Manifest ID", required = true },
                    { name = "Item", column_type = "ref", info = "Item shipped", target_group_table = "items", target_column = "name" },
                    { name = "From Warehouse", column_type = "ref", info = "Source", target_group_table = "warehouses", target_column = "name" },
                    { name = "To Warehouse", column_type = "ref", info = "Destination", target_group_table = "warehouses", target_column = "name" },
                    { name = "Quantity", column_type = "number", info = "Transfer count" },
                    { name = "Status", column_type = "dropdown", info = "Transfer state", options = "Draft, Picked, In Transit, Delivered, Cancelled" },
                },
                rows = {
                    { ["Transfer Code"] = "TRF-2026-081", ["Item"] = 2, ["From Warehouse"] = 1, ["To Warehouse"] = 2, ["Quantity"] = 20, ["Status"] = "Delivered" },
                    { ["Transfer Code"] = "TRF-2026-082", ["Item"] = 1, ["From Warehouse"] = 1, ["To Warehouse"] = 3, ["Quantity"] = 100, ["Status"] = "In Transit" },
                    { ["Transfer Code"] = "TRF-2026-083", ["Item"] = 4, ["From Warehouse"] = 3, ["To Warehouse"] = 1, ["Quantity"] = 50, ["Status"] = "Picked" }
                }
            }
        }
    },
    ["it-helpdesk"] = {
        id = "it-helpdesk",
        name = "IT Asset & Helpdesk",
        description = "Track hardware assets, software licenses, tickets, and maintenance",
        category = "IT",
        icon = "laptop-code",
        color = "cyan",
        tables = {
            {
                id = "hardware",
                name = "Hardware Assets",
                description = "Laptops, monitors, workstations, and serial tags",
                icon = "laptop",
                color = "cyan",
                columns = {
                    { name = "Asset Tag", column_type = "text", info = "Unique asset serial", required = true },
                    { name = "Device Model", column_type = "text", info = "Model e.g. MacBook Pro M3" },
                    { name = "Device Type", column_type = "dropdown", info = "Category", options = "Laptop, Desktop, Display, Mobile Phone, Server" },
                    { name = "Assigned User", column_type = "text", info = "Current user" },
                    { name = "Warranty Expire", column_type = "date", info = "Warranty expiration" },
                },
                rows = {
                    { ["Asset Tag"] = "HW-MBP-101", ["Device Model"] = "MacBook Pro 16\" M3 Max", ["Device Type"] = "Laptop", ["Assigned User"] = "Alex Rivera", ["Warranty Expire"] = "2027-01-15" },
                    { ["Asset Tag"] = "HW-XPS-202", ["Device Model"] = "Dell XPS 15 9530", ["Device Type"] = "Laptop", ["Assigned User"] = "Priya Patel", ["Warranty Expire"] = "2026-11-20" },
                    { ["Asset Tag"] = "HW-MON-303", ["Device Model"] = "LG UltraFine 27\" 4K", ["Device Type"] = "Display", ["Assigned User"] = "Chen Wei", ["Warranty Expire"] = "2026-08-30" },
                    { ["Asset Tag"] = "HW-SVR-404", ["Device Model"] = "Dell PowerEdge R760", ["Device Type"] = "Server", ["Assigned User"] = "Infrastructure Team", ["Warranty Expire"] = "2028-05-10" }
                }
            },
            {
                id = "software",
                name = "Software Licenses",
                description = "SaaS subscriptions, seat counts, and annual renewals",
                icon = "certificate",
                color = "indigo",
                columns = {
                    { name = "Software Name", column_type = "text", info = "Tool name", required = true },
                    { name = "Vendor", column_type = "text", info = "Publisher" },
                    { name = "Seats Purchased", column_type = "number", info = "Total seats" },
                    { name = "Renewal Date", column_type = "date", info = "Renewal deadline" },
                    { name = "Annual Cost", column_type = "number", info = "Cost in USD" },
                },
                rows = {
                    { ["Software Name"] = "Slack Enterprise Grid", ["Vendor"] = "Salesforce", ["Seats Purchased"] = 250, ["Renewal Date"] = "2027-03-01", ["Annual Cost"] = 36000 },
                    { ["Software Name"] = "Figma Enterprise", ["Vendor"] = "Figma Inc", ["Seats Purchased"] = 45, ["Renewal Date"] = "2026-12-15", ["Annual Cost"] = 18900 },
                    { ["Software Name"] = "GitHub Enterprise Cloud", ["Vendor"] = "Microsoft", ["Seats Purchased"] = 180, ["Renewal Date"] = "2027-05-01", ["Annual Cost"] = 45000 }
                }
            },
            {
                id = "tickets",
                name = "Support Tickets",
                description = "Employee IT issues, triage priority, and resolutions",
                icon = "ticket-simple",
                color = "rose",
                columns = {
                    { name = "Ticket Subject", column_type = "text", info = "Issue title", required = true },
                    { name = "Requester", column_type = "text", info = "Employee name" },
                    { name = "Related Hardware", column_type = "ref", info = "Troubled device", target_group_table = "hardware", target_column = "name" },
                    { name = "Priority", column_type = "dropdown", info = "Urgency", options = "Low, Medium, High, Critical" },
                    { name = "Status", column_type = "dropdown", info = "Resolution progress", options = "New, Assigned, In Progress, Waiting for User, Resolved" },
                },
                rows = {
                    { ["Ticket Subject"] = "External display flickering over Thunderbolt", ["Requester"] = "Chen Wei", ["Related Hardware"] = 3, ["Priority"] = "Medium", ["Status"] = "In Progress" },
                    { ["Ticket Subject"] = "Battery draining abnormally fast after update", ["Requester"] = "Alex Rivera", ["Related Hardware"] = 1, ["Priority"] = "High", ["Status"] = "Assigned" },
                    { ["Ticket Subject"] = "Memory upgrade request for local virtualization", ["Requester"] = "Priya Patel", ["Related Hardware"] = 2, ["Priority"] = "Low", ["Status"] = "Resolved" }
                }
            }
        }
    },
    ["property-rentals"] = {
        id = "property-rentals",
        name = "Property & Rental Management",
        description = "Manage buildings, rental units, tenant leases, and repair requests",
        category = "Real Estate",
        icon = "city",
        color = "emerald",
        tables = {
            {
                id = "properties",
                name = "Properties",
                description = "Real estate complexes, addresses, and property managers",
                icon = "building",
                color = "emerald",
                columns = {
                    { name = "Property Name", column_type = "text", info = "Building title", required = true },
                    { name = "Street Address", column_type = "text", info = "Street address" },
                    { name = "Property Type", column_type = "dropdown", info = "Category", options = "Apartment Building, Office Tower, Retail Plaza, Residential Complex" },
                    { name = "Total Units", column_type = "number", info = "Number of units" },
                },
                rows = {
                    { ["Property Name"] = "Oakwood Luxury Residences", ["Street Address"] = "742 Evergreen Terrace", ["Property Type"] = "Apartment Building", ["Total Units"] = 48 },
                    { ["Property Name"] = "Highland Commercial Plaza", ["Street Address"] = "1200 Market Street", ["Property Type"] = "Retail Plaza", ["Total Units"] = 16 },
                    { ["Property Name"] = "Riverside Lofts", ["Street Address"] = "350 Waterway Blvd", ["Property Type"] = "Residential Complex", ["Total Units"] = 24 }
                }
            },
            {
                id = "units",
                name = "Rental Units",
                description = "Apartments, monthly rent rates, and occupancy status",
                icon = "door-open",
                color = "blue",
                columns = {
                        { name = "Unit Number", column_type = "text", info = "Unit e.g. Apt 4B", required = true },
                    { name = "Property", column_type = "ref", info = "Belongs to building", target_group_table = "properties", target_column = "name", required = true },
                    { name = "Bedrooms", column_type = "number", info = "Bedroom count" },
                    { name = "Monthly Rent", column_type = "number", info = "Rent amount in USD" },
                    { name = "Status", column_type = "dropdown", info = "Occupancy", options = "Vacant, Leased, Maintenance, Reserved" },
                },
                rows = {
                    { ["Unit Number"] = "Apt 201", ["Property"] = 1, ["Bedrooms"] = 2, ["Monthly Rent"] = 2800, ["Status"] = "Leased" },
                    { ["Unit Number"] = "Apt 202", ["Property"] = 1, ["Bedrooms"] = 1, ["Monthly Rent"] = 2100, ["Status"] = "Vacant" },
                    { ["Unit Number"] = "Suite 104", ["Property"] = 2, ["Bedrooms"] = 0, ["Monthly Rent"] = 4500, ["Status"] = "Leased" },
                    { ["Unit Number"] = "Loft 3B", ["Property"] = 3, ["Bedrooms"] = 2, ["Monthly Rent"] = 3200, ["Status"] = "Leased" }
                }
            },
            {
                id = "tenants",
                name = "Tenants & Leases",
                description = "Lease agreements, tenant contact, and security deposits",
                icon = "file-signature",
                color = "amber",
                columns = {
                    { name = "Tenant Name", column_type = "text", info = "Primary lessee", required = true },
                    { name = "Unit", column_type = "ref", info = "Rented unit", target_group_table = "units", target_column = "name", required = true },
                    { name = "Email", column_type = "email", info = "Tenant email" },
                    { name = "Phone", column_type = "text", info = "Phone" },
                    { name = "Lease Start", column_type = "date", info = "Start date" },
                    { name = "Lease End", column_type = "date", info = "Expiration date" },
                },
                rows = {
                    { ["Tenant Name"] = "Benjamin Hayes", ["Unit"] = 1, ["Email"] = "bhayes@example.com", ["Phone"] = "+1-555-0812", ["Lease Start"] = "2026-01-01", ["Lease End"] = "2026-12-31" },
                    { ["Tenant Name"] = "Artisan Bakery LLC", ["Unit"] = 3, ["Email"] = "contact@artisanbakery.com", ["Phone"] = "+1-555-0899", ["Lease Start"] = "2025-06-01", ["Lease End"] = "2028-05-31" },
                    { ["Tenant Name"] = "Claire Dupont", ["Unit"] = 4, ["Email"] = "cdupont@example.com", ["Phone"] = "+1-555-0744", ["Lease Start"] = "2026-04-01", ["Lease End"] = "2027-03-31" }
                }
            },
            {
                id = "maintenance",
                name = "Maintenance Requests",
                description = "Tenant repair tickets, urgency, and contractor dispatch",
                icon = "screwdriver-wrench",
                color = "rose",
                columns = {
                    { name = "Unit", column_type = "ref", info = "Affected unit", target_group_table = "units", target_column = "name", required = true },
                    { name = "Issue Summary", column_type = "text", info = "Problem description", required = true },
                    { name = "Priority", column_type = "dropdown", info = "Urgency", options = "Routine, Medium, Urgent, Emergency" },
                    { name = "Status", column_type = "dropdown", info = "Resolution", options = "New, Scheduled, Parts On Order, Completed" },
                },
                rows = {
                    { ["Unit"] = 1, ["Issue Summary"] = "Dishwasher leaking water from front door seal", ["Priority"] = "Medium", ["Status"] = "Scheduled" },
                    { ["Unit"] = 3, ["Issue Summary"] = "HVAC unit blowing warm air during afternoon peak", ["Priority"] = "Urgent", ["Status"] = "Parts On Order" },
                    { ["Unit"] = 4, ["Issue Summary"] = "Bathroom vanity cold water faucet dripping", ["Priority"] = "Routine", ["Status"] = "Completed" }
                }
            }
        }
    },
    ["clinic-patients"] = {
        id = "clinic-patients",
        name = "Clinic & Patient Care",
        description = "Patient records, attending physicians, appointment visits, and prescriptions",
        category = "Healthcare",
        icon = "hospital",
        color = "red",
        tables = {
            {
                id = "patients",
                name = "Patients",
                description = "Patient demographics, medical IDs, and emergency contacts",
                icon = "user-injured",
                color = "red",
                columns = {
                    { name = "Patient Name", column_type = "text", info = "Full legal name", required = true },
                    { name = "Medical Record #", column_type = "text", info = "MRN ID" },
                    { name = "Date of Birth", column_type = "date", info = "Birth date" },
                    { name = "Blood Type", column_type = "dropdown", info = "Blood group", options = "A+, A-, B+, B-, AB+, AB-, O+, O-" },
                    { name = "Phone", column_type = "text", info = "Contact phone" },
                },
                rows = {
                    { ["Patient Name"] = "Jonathan Reed", ["Medical Record #"] = "MRN-8821", ["Date of Birth"] = "1985-06-14", ["Blood Type"] = "O+", ["Phone"] = "+1-555-0321" },
                    { ["Patient Name"] = "Emily Watson", ["Medical Record #"] = "MRN-8822", ["Date of Birth"] = "1992-11-28", ["Blood Type"] = "A-", ["Phone"] = "+1-555-0322" },
                    { ["Patient Name"] = "Robert Takahashi", ["Medical Record #"] = "MRN-8823", ["Date of Birth"] = "1978-03-04", ["Blood Type"] = "B+", ["Phone"] = "+1-555-0323" },
                    { ["Patient Name"] = "Maria Hernandez", ["Medical Record #"] = "MRN-8824", ["Date of Birth"] = "2001-09-19", ["Blood Type"] = "AB+", ["Phone"] = "+1-555-0324" }
                }
            },
            {
                id = "physicians",
                name = "Doctors & Staff",
                description = "Medical specialists, clinic rooms, and licenses",
                icon = "user-doctor",
                color = "blue",
                columns = {
                    { name = "Doctor Name", column_type = "text", info = "Physician name", required = true },
                    { name = "Specialty", column_type = "dropdown", info = "Medical field", options = "General Practice, Pediatrics, Cardiology, Orthopedics, Dermatology" },
                    { name = "Office Room", column_type = "text", info = "Clinic room number" },
                },
                rows = {
                    { ["Doctor Name"] = "Dr. Gregory Vance", ["Specialty"] = "General Practice", ["Office Room"] = "Room 101" },
                    { ["Doctor Name"] = "Dr. Allison Becker", ["Specialty"] = "Cardiology", ["Office Room"] = "Room 205" },
                    { ["Doctor Name"] = "Dr. James Wilson", ["Specialty"] = "Pediatrics", ["Office Room"] = "Room 108" }
                }
            },
            {
                id = "appointments",
                name = "Appointments",
                description = "Scheduled patient visits, consultation dates, and triage",
                icon = "calendar-plus",
                color = "emerald",
                columns = {
                    { name = "Patient", column_type = "ref", info = "Visiting patient", target_group_table = "patients", target_column = "name", required = true },
                    { name = "Doctor", column_type = "ref", info = "Attending doctor", target_group_table = "physicians", target_column = "name" },
                    { name = "Date", column_type = "date", info = "Consultation date", required = true },
                    { name = "Time", column_type = "time", info = "Time of day" },
                    { name = "Status", column_type = "dropdown", info = "Visit state", options = "Scheduled, Checked-In, In Consultation, Completed, Cancelled" },
                },
                rows = {
                    { ["Patient"] = 1, ["Doctor"] = 1, ["Date"] = "2026-09-28", ["Time"] = "10:00", ["Status"] = "Completed" },
                    { ["Patient"] = 2, ["Doctor"] = 2, ["Date"] = "2026-09-28", ["Time"] = "11:30", ["Status"] = "Completed" },
                    { ["Patient"] = 3, ["Doctor"] = 1, ["Date"] = "2026-09-29", ["Time"] = "09:00", ["Status"] = "Scheduled" },
                    { ["Patient"] = 4, ["Doctor"] = 3, ["Date"] = "2026-09-29", ["Time"] = "14:15", ["Status"] = "Scheduled" }
                }
            },
            {
                id = "prescriptions",
                name = "Prescriptions",
                description = "Prescribed medicines, dosages, and treatment instructions",
                icon = "pills",
                color = "purple",
                columns = {
                    { name = "Patient", column_type = "ref", info = "Patient", target_group_table = "patients", target_column = "name", required = true },
                    { name = "Medication Name", column_type = "text", info = "Drug name", required = true },
                    { name = "Dosage", column_type = "text", info = "Dose e.g. 500mg twice daily" },
                    { name = "Duration", column_type = "text", info = "Duration e.g. 7 days" },
                },
                rows = {
                    { ["Patient"] = 1, ["Medication Name"] = "Amoxicillin 500mg", ["Dosage"] = "1 capsule every 8 hours", ["Duration"] = "7 days" },
                    { ["Patient"] = 2, ["Medication Name"] = "Atorvastatin 20mg", ["Dosage"] = "1 tablet daily before bedtime", ["Duration"] = "30 days" },
                    { ["Patient"] = 3, ["Medication Name"] = "Lisinopril 10mg", ["Dosage"] = "1 tablet once daily in morning", ["Duration"] = "90 days" }
                }
            }
        }
    },
    ["publishing-editorial"] = {
        id = "publishing-editorial",
        name = "Editorial & Content Publishing",
        description = "Editorial pipeline for articles, author directory, publication channels, and tasks",
        category = "Media",
        icon = "newspaper",
        color = "violet",
        tables = {
            {
                id = "articles",
                name = "Articles",
                description = "Drafts, editorial review stages, and publication schedules",
                icon = "feather-pointed",
                color = "violet",
                columns = {
                    { name = "Headline", column_type = "text", info = "Article headline", required = true },
                    { name = "Topic Section", column_type = "dropdown", info = "Section", options = "Technology, Politics, Culture, Business, Science, Lifestyle" },
                    { name = "Status", column_type = "dropdown", info = "Editorial workflow", options = "Pitch, In Writing, Editor Review, Ready to Publish, Published" },
                    { name = "Publish Date", column_type = "date", info = "Scheduled date" },
                    { name = "Word Count", column_type = "number", info = "Article length" },
                },
                rows = {
                    { ["Headline"] = "The Future of Distributed Local-First Applications", ["Topic Section"] = "Technology", ["Status"] = "Published", ["Publish Date"] = "2026-09-20", ["Word Count"] = 1850 },
                    { ["Headline"] = "Design Systems in Practice: Consistency at Scale", ["Topic Section"] = "Technology", ["Status"] = "Editor Review", ["Publish Date"] = "2026-10-02", ["Word Count"] = 2400 },
                    { ["Headline"] = "How Autonomous Code Assistants Reshape Engineering Teams", ["Topic Section"] = "Business", ["Status"] = "Ready to Publish", ["Publish Date"] = "2026-09-30", ["Word Count"] = 1600 }
                }
            },
            {
                id = "authors",
                name = "Authors & Writers",
                description = "Contributors, staff journalists, and freelancer roster",
                icon = "pen-nib",
                color = "blue",
                columns = {
                    { name = "Author Name", column_type = "text", info = "Byline name", required = true },
                    { name = "Role Type", column_type = "dropdown", info = "Contributor type", options = "Staff Writer, Columnist, Freelancer, Guest" },
                    { name = "Email", column_type = "email", info = "Email address" },
                },
                rows = {
                    { ["Author Name"] = "Jordan Lee", ["Role Type"] = "Staff Writer", ["Email"] = "jordan.l@publication.io" },
                    { ["Author Name"] = "Samira Khan", ["Role Type"] = "Columnist", ["Email"] = "samira.k@publication.io" },
                    { ["Author Name"] = "Lucas Vance", ["Role Type"] = "Freelancer", ["Email"] = "lucas.v@freelance.net" }
                }
            },
            {
                id = "editorial-tasks",
                name = "Editorial Checklist",
                description = "Fact checking, photo permissions, copyediting, and SEO tasks",
                icon = "list-check",
                color = "amber",
                columns = {
                    { name = "Article", column_type = "ref", info = "Target article", target_group_table = "articles", target_column = "name", required = true },
                    { name = "Checklist Item", column_type = "dropdown", info = "Task type", options = "Fact Check, Copyedit, Graphic / Header Image, SEO Audit, Legal Review" },
                    { name = "Assigned To", column_type = "ref", info = "Assignee", target_group_table = "authors", target_column = "name" },
                    { name = "Complete", column_type = "checkbox", info = "Is verified" },
                },
                rows = {
                    { ["Article"] = 1, ["Checklist Item"] = "Fact Check", ["Assigned To"] = 1, ["Complete"] = true },
                    { ["Article"] = 1, ["Checklist Item"] = "SEO Audit", ["Assigned To"] = 2, ["Complete"] = true },
                    { ["Article"] = 2, ["Checklist Item"] = "Copyedit", ["Assigned To"] = 2, ["Complete"] = false },
                    { ["Article"] = 3, ["Checklist Item"] = "Graphic / Header Image", ["Assigned To"] = 3, ["Complete"] = true }
                }
            }
        }
    }
}

function M.get_template(key)
    return M.TABLE_GROUPS[key]
end

return M
