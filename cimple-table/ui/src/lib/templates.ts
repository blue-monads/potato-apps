import { createDatatable, createColumn } from "./api";

export interface ColumnTemplate {
    name: string;
    column_type: string;
    info?: string;
    required?: boolean;
    options?: string;
    icon?: string;
    target_group_table?: string;
    target_column?: string;
}

export interface TableInGroupTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    color?: string;
    columns: ColumnTemplate[];
}

export interface TableGroupTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    color: string;
    tables: TableInGroupTemplate[];
}

// For backwards compatibility
export interface TableTemplate extends TableInGroupTemplate {}

export const TABLE_GROUP_TEMPLATES: TableGroupTemplate[] = [
    {
        id: "school-attendance",
        name: "Student & School Management",
        description: "Track students, subjects, daily attendance, and exam grades in one connected system",
        category: "Education",
        icon: "graduation-cap",
        color: "blue",
        tables: [
            {
                id: "students",
                name: "Students",
                description: "Student roster, enrollment details, and parent contact",
                icon: "user-graduate",
                color: "blue",
                columns: [
                    { name: "Full Name", column_type: "text", info: "Student's full name", required: true },
                    { name: "Roll Number", column_type: "text", info: "Unique student ID or roll number" },
                    { name: "Grade Class", column_type: "dropdown", info: "Class or grade level", options: "Grade 9, Grade 10, Grade 11, Grade 12" },
                    { name: "Email", column_type: "email", info: "Student or parent email" },
                    { name: "Date of Birth", column_type: "date", info: "Birthday" },
                    { name: "Status", column_type: "dropdown", info: "Enrollment status", options: "Active, Inactive, Graduated, Suspended" },
                ],
            },
            {
                id: "subjects",
                name: "Subjects",
                description: "Curriculum courses, subject codes, and assigned teachers",
                icon: "book-open",
                color: "indigo",
                columns: [
                    { name: "Subject Name", column_type: "text", info: "Course name", required: true },
                    { name: "Code", column_type: "text", info: "Subject identifier code" },
                    { name: "Department", column_type: "dropdown", info: "Academic department", options: "Mathematics, Science, Humanities, Arts, Languages" },
                    { name: "Teacher", column_type: "text", info: "Primary instructor" },
                    { name: "Credits", column_type: "number", info: "Credit hours" },
                ],
            },
            {
                id: "attendance",
                name: "Attendance",
                description: "Daily student class attendance logs and status",
                icon: "clipboard-user",
                color: "emerald",
                columns: [
                    { name: "Student", column_type: "ref", info: "Enrolled student", target_group_table: "students", target_column: "name", required: true },
                    { name: "Subject", column_type: "ref", info: "Attended subject", target_group_table: "subjects", target_column: "name" },
                    { name: "Date", column_type: "date", info: "Date of session", required: true },
                    { name: "Status", column_type: "dropdown", info: "Attendance status", options: "Present, Absent, Late, Excused" },
                    { name: "Remarks", column_type: "text", info: "Notes or reason" },
                ],
            },
            {
                id: "grades",
                name: "Grades & Exams",
                description: "Term assessment scores, exam types, and final grades",
                icon: "award",
                color: "violet",
                columns: [
                    { name: "Student", column_type: "ref", info: "Student", target_group_table: "students", target_column: "name", required: true },
                    { name: "Subject", column_type: "ref", info: "Subject", target_group_table: "subjects", target_column: "name", required: true },
                    { name: "Exam Term", column_type: "dropdown", info: "Assessment cycle", options: "Midterm Exam, Final Exam, Quiz 1, Quiz 2, Project" },
                    { name: "Score", column_type: "number", info: "Obtained marks" },
                    { name: "Max Score", column_type: "number", info: "Total possible marks" },
                    { name: "Grade", column_type: "dropdown", info: "Letter grade", options: "A+, A, B+, B, C, D, F" },
                ],
            },
        ],
    },
    {
        id: "ecommerce-orders",
        name: "E-Commerce & Orders",
        description: "Manage product catalogs, customer accounts, orders, and line items",
        category: "Commerce",
        icon: "cart-shopping",
        color: "emerald",
        tables: [
            {
                id: "products",
                name: "Products",
                description: "Product inventory, pricing, and stock status",
                icon: "box",
                color: "emerald",
                columns: [
                    { name: "Product Name", column_type: "text", info: "Name of item", required: true },
                    { name: "SKU", column_type: "text", info: "Stock keeping unit" },
                    { name: "Category", column_type: "dropdown", info: "Product category", options: "Electronics, Apparel, Home & Kitchen, Health, Books" },
                    { name: "Unit Price", column_type: "number", info: "Price in USD" },
                    { name: "Stock Quantity", column_type: "number", info: "Current inventory count" },
                    { name: "Status", column_type: "dropdown", info: "Availability", options: "In Stock, Low Stock, Backordered, Discontinued" },
                ],
            },
            {
                id: "customers",
                name: "Customers",
                description: "Customer directory, contact information, and tiers",
                icon: "users",
                color: "blue",
                columns: [
                    { name: "Customer Name", column_type: "text", info: "Full name", required: true },
                    { name: "Email", column_type: "email", info: "Contact email" },
                    { name: "Phone", column_type: "text", info: "Phone number" },
                    { name: "City", column_type: "text", info: "Customer city" },
                    { name: "Tier", column_type: "dropdown", info: "Loyalty tier", options: "Standard, Silver, Gold, VIP" },
                ],
            },
            {
                id: "orders",
                name: "Orders",
                description: "Customer purchase orders, payment, and shipping status",
                icon: "receipt",
                color: "amber",
                columns: [
                    { name: "Order Number", column_type: "text", info: "Order ID #", required: true },
                    { name: "Customer", column_type: "ref", info: "Placing customer", target_group_table: "customers", target_column: "name", required: true },
                    { name: "Order Date", column_type: "date", info: "Date placed" },
                    { name: "Total Amount", column_type: "number", info: "Total order sum" },
                    { name: "Payment Status", column_type: "dropdown", info: "Payment status", options: "Pending, Paid, Refunded, Failed" },
                    { name: "Fulfillment", column_type: "dropdown", info: "Shipping status", options: "Unfulfilled, Processing, Shipped, Delivered, Returned" },
                ],
            },
            {
                id: "order-items",
                name: "Order Items",
                description: "Individual products and quantities tied to orders",
                icon: "list-check",
                color: "purple",
                columns: [
                    { name: "Order", column_type: "ref", info: "Related order", target_group_table: "orders", target_column: "name", required: true },
                    { name: "Product", column_type: "ref", info: "Ordered product", target_group_table: "products", target_column: "name", required: true },
                    { name: "Quantity", column_type: "number", info: "Item quantity", required: true },
                    { name: "Unit Price", column_type: "number", info: "Price per unit" },
                    { name: "Subtotal", column_type: "number", info: "Line total" },
                ],
            },
        ],
    },
    {
        id: "project-tasks",
        name: "Project Management & Sprints",
        description: "Coordinate team projects, milestones, tasks, and member assignments",
        category: "Productivity",
        icon: "kanban",
        color: "indigo",
        tables: [
            {
                id: "projects",
                name: "Projects",
                description: "Initiatives, timelines, and overall status",
                icon: "folder-tree",
                color: "indigo",
                columns: [
                    { name: "Project Name", column_type: "text", info: "Project title", required: true },
                    { name: "Key Code", column_type: "text", info: "Short code e.g. PRJ" },
                    { name: "Status", column_type: "dropdown", info: "Lifecycle status", options: "Planning, In Progress, On Hold, Completed" },
                    { name: "Start Date", column_type: "date", info: "Project kickoff" },
                    { name: "Target Date", column_type: "date", info: "Target completion" },
                    { name: "Budget", column_type: "number", info: "Allocated budget" },
                ],
            },
            {
                id: "team-members",
                name: "Team Members",
                description: "Team roster, departments, and roles",
                icon: "user-group",
                color: "cyan",
                columns: [
                    { name: "Member Name", column_type: "text", info: "Full name", required: true },
                    { name: "Role", column_type: "text", info: "Job title" },
                    { name: "Department", column_type: "dropdown", info: "Department", options: "Engineering, Product, Design, QA, Marketing" },
                    { name: "Email", column_type: "email", info: "Work email" },
                ],
            },
            {
                id: "milestones",
                name: "Milestones",
                description: "Key project deliverables and deadlines",
                icon: "flag-checkered",
                color: "rose",
                columns: [
                    { name: "Milestone", column_type: "text", info: "Milestone title", required: true },
                    { name: "Project", column_type: "ref", info: "Belongs to project", target_group_table: "projects", target_column: "name", required: true },
                    { name: "Due Date", column_type: "date", info: "Target due date" },
                    { name: "Status", column_type: "dropdown", info: "Status", options: "Not Started, On Track, At Risk, Achieved" },
                ],
            },
            {
                id: "tasks",
                name: "Tasks",
                description: "Actionable tasks with assignees and priority",
                icon: "list-check",
                color: "emerald",
                columns: [
                    { name: "Task Title", column_type: "text", info: "Task description", required: true },
                    { name: "Project", column_type: "ref", info: "Project", target_group_table: "projects", target_column: "name" },
                    { name: "Assignee", column_type: "ref", info: "Assigned team member", target_group_table: "team-members", target_column: "name" },
                    { name: "Status", column_type: "dropdown", info: "Progress state", options: "Backlog, Todo, In Progress, In Review, Done" },
                    { name: "Priority", column_type: "dropdown", info: "Urgency", options: "Low, Medium, High, Urgent" },
                    { name: "Due Date", column_type: "date", info: "Due date" },
                ],
            },
        ],
    },
    {
        id: "crm-pipeline",
        name: "CRM & Sales Pipeline",
        description: "Track company accounts, sales leads, deals, and engagement activities",
        category: "Sales",
        icon: "handshake",
        color: "violet",
        tables: [
            {
                id: "accounts",
                name: "Accounts",
                description: "Target companies and corporate clients",
                icon: "building",
                color: "violet",
                columns: [
                    { name: "Company Name", column_type: "text", info: "Organization name", required: true },
                    { name: "Industry", column_type: "dropdown", info: "Industry sector", options: "SaaS & Tech, Healthcare, Finance, Retail, Manufacturing" },
                    { name: "Website", column_type: "link", info: "Company website" },
                    { name: "Annual Revenue", column_type: "number", info: "Estimated revenue" },
                    { name: "Location", column_type: "text", info: "Headquarters city" },
                ],
            },
            {
                id: "contacts",
                name: "Contacts",
                description: "Stakeholders and decision makers at client accounts",
                icon: "address-card",
                color: "blue",
                columns: [
                    { name: "Contact Name", column_type: "text", info: "Person's name", required: true },
                    { name: "Company", column_type: "ref", info: "Associated company", target_group_table: "accounts", target_column: "name" },
                    { name: "Job Title", column_type: "text", info: "Position" },
                    { name: "Email", column_type: "email", info: "Direct email" },
                    { name: "Phone", column_type: "text", info: "Direct phone" },
                    { name: "Stage", column_type: "dropdown", info: "Contact status", options: "Lead, Prospect, Customer, Churned" },
                ],
            },
            {
                id: "deals",
                name: "Deals Pipeline",
                description: "Sales opportunities, deal stages, and expected revenue",
                icon: "funnel-dollar",
                color: "emerald",
                columns: [
                    { name: "Deal Name", column_type: "text", info: "Opportunity title", required: true },
                    { name: "Account", column_type: "ref", info: "Client company", target_group_table: "accounts", target_column: "name" },
                    { name: "Value", column_type: "number", info: "Contract value" },
                    { name: "Stage", column_type: "dropdown", info: "Sales stage", options: "Prospecting, Qualification, Proposal Sent, Negotiation, Closed Won, Closed Lost" },
                    { name: "Target Close", column_type: "date", info: "Target close date" },
                ],
            },
            {
                id: "activities",
                name: "Sales Activities",
                description: "Calls, demos, emails, and meetings logged with clients",
                icon: "phone-volume",
                color: "amber",
                columns: [
                    { name: "Deal", column_type: "ref", info: "Related deal", target_group_table: "deals", target_column: "name" },
                    { name: "Activity Type", column_type: "dropdown", info: "Type of touchpoint", options: "Call, Discovery Meeting, Product Demo, Email Followup, Lunch" },
                    { name: "Date", column_type: "date", info: "Date of activity", required: true },
                    { name: "Summary Notes", column_type: "textarea", info: "Key takeaways" },
                ],
            },
        ],
    },
    {
        id: "hr-directory",
        name: "HR & Employee Directory",
        description: "Manage staff directory, department structures, leave requests, and performance",
        category: "HR",
        icon: "id-badge",
        color: "teal",
        tables: [
            {
                id: "departments",
                name: "Departments",
                description: "Organizational units and department heads",
                icon: "sitemap",
                color: "teal",
                columns: [
                    { name: "Department Name", column_type: "text", info: "Department name", required: true },
                    { name: "Department Head", column_type: "text", info: "Leader name" },
                    { name: "Budget", column_type: "number", info: "Annual budget" },
                    { name: "Office Floor", column_type: "text", info: "Location" },
                ],
            },
            {
                id: "employees",
                name: "Employees",
                description: "Staff roster, employee IDs, and employment details",
                icon: "user-tie",
                color: "blue",
                columns: [
                    { name: "Full Name", column_type: "text", info: "Employee name", required: true },
                    { name: "Employee ID", column_type: "text", info: "Work ID number" },
                    { name: "Department", column_type: "ref", info: "Assigned department", target_group_table: "departments", target_column: "name" },
                    { name: "Job Title", column_type: "text", info: "Official designation" },
                    { name: "Work Email", column_type: "email", info: "Work email" },
                    { name: "Employment Type", column_type: "dropdown", info: "Contract type", options: "Full-Time, Part-Time, Contractor, Intern" },
                    { name: "Join Date", column_type: "date", info: "Hire date" },
                ],
            },
            {
                id: "leave-requests",
                name: "Leave Requests",
                description: "Time-off submissions, approvals, and vacation tracking",
                icon: "calendar-check",
                color: "amber",
                columns: [
                    { name: "Employee", column_type: "ref", info: "Requesting employee", target_group_table: "employees", target_column: "name", required: true },
                    { name: "Leave Type", column_type: "dropdown", info: "Category", options: "Paid Vacation, Sick Leave, Personal Day, Parental Leave, Unpaid" },
                    { name: "Start Date", column_type: "date", info: "First day off", required: true },
                    { name: "End Date", column_type: "date", info: "Last day off" },
                    { name: "Status", column_type: "dropdown", info: "Approval status", options: "Submitted, Approved, Rejected, Cancelled" },
                ],
            },
            {
                id: "reviews",
                name: "Performance Reviews",
                description: "Periodic evaluations, feedback, and rating scorecards",
                icon: "star",
                color: "purple",
                columns: [
                    { name: "Employee", column_type: "ref", info: "Reviewed employee", target_group_table: "employees", target_column: "name", required: true },
                    { name: "Review Cycle", column_type: "dropdown", info: "Cycle period", options: "Q1 Review, Q2 Review, Q3 Review, Q4 Review, Annual Review" },
                    { name: "Rating", column_type: "rating", info: "Score 1-5" },
                    { name: "Reviewer", column_type: "text", info: "Manager conducting review" },
                    { name: "Key Strengths", column_type: "textarea", info: "Notable strengths" },
                ],
            },
        ],
    },
    {
        id: "events-conference",
        name: "Event & Conference Planning",
        description: "Coordinate event agendas, guest speakers, sessions, and ticket registrations",
        category: "Events",
        icon: "calendar-days",
        color: "rose",
        tables: [
            {
                id: "events",
                name: "Events",
                description: "Conferences, summits, and venue details",
                icon: "landmark",
                color: "rose",
                columns: [
                    { name: "Event Title", column_type: "text", info: "Official event name", required: true },
                    { name: "Event Type", column_type: "dropdown", info: "Format", options: "In-Person Conference, Virtual Summit, Workshop, Gala Dinner" },
                    { name: "Start Date", column_type: "date", info: "Opening date" },
                    { name: "End Date", column_type: "date", info: "Closing date" },
                    { name: "Venue", column_type: "text", info: "Location or platform" },
                    { name: "Capacity", column_type: "number", info: "Max attendees" },
                ],
            },
            {
                id: "speakers",
                name: "Speakers",
                description: "Keynote and session presenters directory",
                icon: "bullhorn",
                color: "violet",
                columns: [
                    { name: "Speaker Name", column_type: "text", info: "Presenter name", required: true },
                    { name: "Organization", column_type: "text", info: "Affiliated company" },
                    { name: "Bio", column_type: "textarea", info: "Short biography" },
                    { name: "Email", column_type: "email", info: "Contact email" },
                ],
            },
            {
                id: "sessions",
                name: "Sessions Agenda",
                description: "Scheduled talks, workshops, and breakout panels",
                icon: "clock",
                color: "blue",
                columns: [
                    { name: "Session Title", column_type: "text", info: "Talk title", required: true },
                    { name: "Event", column_type: "ref", info: "Belongs to event", target_group_table: "events", target_column: "name", required: true },
                    { name: "Speaker", column_type: "ref", info: "Speaker", target_group_table: "speakers", target_column: "name" },
                    { name: "Start Time", column_type: "time", info: "Session start" },
                    { name: "Room", column_type: "text", info: "Hall / Room" },
                ],
            },
            {
                id: "registrations",
                name: "Attendee Registrations",
                description: "Ticket orders and attendee check-in status",
                icon: "ticket",
                color: "emerald",
                columns: [
                    { name: "Attendee Name", column_type: "text", info: "Guest name", required: true },
                    { name: "Event", column_type: "ref", info: "Registered event", target_group_table: "events", target_column: "name", required: true },
                    { name: "Ticket Tier", column_type: "dropdown", info: "Pass type", options: "General Admission, VIP Pass, Early Bird, Student" },
                    { name: "Email", column_type: "email", info: "Ticket confirmation email" },
                    { name: "Checked In", column_type: "checkbox", info: "Badge printed / scanned" },
                ],
            },
        ],
    },
    {
        id: "restaurant-orders",
        name: "Restaurant & Table Bookings",
        description: "Menu catalog, table reservations, and live dining orders",
        category: "Hospitality",
        icon: "utensils",
        color: "amber",
        tables: [
            {
                id: "menu-items",
                name: "Menu Items",
                description: "Dishes, drinks, pricing, and allergen details",
                icon: "bowl-food",
                color: "amber",
                columns: [
                    { name: "Dish Name", column_type: "text", info: "Item name", required: true },
                    { name: "Category", column_type: "dropdown", info: "Course category", options: "Appetizers, Mains, Desserts, Cocktails, Non-Alcoholic" },
                    { name: "Price", column_type: "number", info: "Menu price" },
                    { name: "Dietary", column_type: "multiselect", info: "Dietary badges", options: "Vegetarian, Vegan, Gluten-Free, Nut-Free, Halal" },
                    { name: "Available", column_type: "checkbox", info: "In kitchen stock" },
                ],
            },
            {
                id: "reservations",
                name: "Table Reservations",
                description: "Guest bookings, party sizes, and scheduled times",
                icon: "calendar-check",
                color: "rose",
                columns: [
                    { name: "Guest Name", column_type: "text", info: "Primary diner", required: true },
                    { name: "Party Size", column_type: "number", info: "Number of guests", required: true },
                    { name: "Reservation Date", column_type: "date", info: "Date" },
                    { name: "Seating Time", column_type: "time", info: "Reservation time" },
                    { name: "Table Number", column_type: "number", info: "Assigned table" },
                    { name: "Status", column_type: "dropdown", info: "Booking state", options: "Confirmed, Seated, Completed, Cancelled, No-Show" },
                ],
            },
            {
                id: "kitchen-orders",
                name: "Dining Orders",
                description: "Tickets sent to kitchen and table billing",
                icon: "receipt",
                color: "blue",
                columns: [
                    { name: "Reservation", column_type: "ref", info: "Table booking", target_group_table: "reservations", target_column: "name" },
                    { name: "Server", column_type: "text", info: "Assigned server" },
                    { name: "Ordered Dish", column_type: "ref", info: "Menu item", target_group_table: "menu-items", target_column: "name" },
                    { name: "Quantity", column_type: "number", info: "Serving count" },
                    { name: "Order Status", column_type: "dropdown", info: "Preparation status", options: "Received, Cooking, Plated, Served, Paid" },
                ],
            },
        ],
    },
    {
        id: "warehouse-inventory",
        name: "Warehouse & Logistics",
        description: "Multi-warehouse stock levels, SKU items, and internal transfer manifests",
        category: "Operations",
        icon: "warehouse",
        color: "orange",
        tables: [
            {
                id: "items",
                name: "Inventory Items",
                description: "Physical items, barcodes, and master specifications",
                icon: "barcode",
                color: "orange",
                columns: [
                    { name: "Item Name", column_type: "text", info: "Product title", required: true },
                    { name: "Barcode", column_type: "barcode", info: "Scannable barcode" },
                    { name: "SKU", column_type: "text", info: "Inventory code" },
                    { name: "Category", column_type: "dropdown", info: "Type", options: "Raw Materials, Finished Goods, Packaging, Spare Parts" },
                    { name: "Unit of Measure", column_type: "dropdown", info: "UOM", options: "Pieces, Boxes, Kilograms, Liters, Pallets" },
                ],
            },
            {
                id: "warehouses",
                name: "Warehouses",
                description: "Storage facilities, distribution centers, and managers",
                icon: "building-shield",
                color: "slate",
                columns: [
                    { name: "Facility Name", column_type: "text", info: "Warehouse name", required: true },
                    { name: "Facility Code", column_type: "text", info: "Code e.g. WH-EAST" },
                    { name: "City", column_type: "text", info: "Location city" },
                    { name: "Manager", column_type: "text", info: "Facility supervisor" },
                ],
            },
            {
                id: "stock-levels",
                name: "Stock Levels",
                description: "Current on-hand stock and reorder thresholds per warehouse",
                icon: "boxes-stacked",
                color: "emerald",
                columns: [
                    { name: "Item", column_type: "ref", info: "Inventory item", target_group_table: "items", target_column: "name", required: true },
                    { name: "Warehouse", column_type: "ref", info: "Storage site", target_group_table: "warehouses", target_column: "name", required: true },
                    { name: "Quantity On Hand", column_type: "number", info: "Current stock" },
                    { name: "Reorder Point", column_type: "number", info: "Restock trigger quantity" },
                ],
            },
            {
                id: "transfers",
                name: "Stock Transfers",
                description: "Inter-facility transfer shipments and movement logs",
                icon: "truck-ramp-box",
                color: "blue",
                columns: [
                    { name: "Transfer Code", column_type: "text", info: "Manifest ID", required: true },
                    { name: "Item", column_type: "ref", info: "Item shipped", target_group_table: "items", target_column: "name" },
                    { name: "From Warehouse", column_type: "ref", info: "Source", target_group_table: "warehouses", target_column: "name" },
                    { name: "To Warehouse", column_type: "ref", info: "Destination", target_group_table: "warehouses", target_column: "name" },
                    { name: "Quantity", column_type: "number", info: "Transfer count" },
                    { name: "Status", column_type: "dropdown", info: "Transfer state", options: "Draft, Picked, In Transit, Delivered, Cancelled" },
                ],
            },
        ],
    },
    {
        id: "it-helpdesk",
        name: "IT Asset & Helpdesk",
        description: "Track hardware assets, software licenses, tickets, and maintenance",
        category: "IT",
        icon: "laptop-code",
        color: "cyan",
        tables: [
            {
                id: "hardware",
                name: "Hardware Assets",
                description: "Laptops, monitors, workstations, and serial tags",
                icon: "laptop",
                color: "cyan",
                columns: [
                    { name: "Asset Tag", column_type: "text", info: "Unique asset serial", required: true },
                    { name: "Device Model", column_type: "text", info: "Model e.g. MacBook Pro M3" },
                    { name: "Device Type", column_type: "dropdown", info: "Category", options: "Laptop, Desktop, Display, Mobile Phone, Server" },
                    { name: "Assigned User", column_type: "text", info: "Current user" },
                    { name: "Warranty Expire", column_type: "date", info: "Warranty expiration" },
                ],
            },
            {
                id: "software",
                name: "Software Licenses",
                description: "SaaS subscriptions, seat counts, and annual renewals",
                icon: "certificate",
                color: "indigo",
                columns: [
                    { name: "Software Name", column_type: "text", info: "Tool name", required: true },
                    { name: "Vendor", column_type: "text", info: "Publisher" },
                    { name: "Seats Purchased", column_type: "number", info: "Total seats" },
                    { name: "Renewal Date", column_type: "date", info: "Renewal deadline" },
                    { name: "Annual Cost", column_type: "number", info: "Cost in USD" },
                ],
            },
            {
                id: "tickets",
                name: "Support Tickets",
                description: "Employee IT issues, triage priority, and resolutions",
                icon: "ticket-simple",
                color: "rose",
                columns: [
                    { name: "Ticket Subject", column_type: "text", info: "Issue title", required: true },
                    { name: "Requester", column_type: "text", info: "Employee name" },
                    { name: "Related Hardware", column_type: "ref", info: "Troubled device", target_group_table: "hardware", target_column: "name" },
                    { name: "Priority", column_type: "dropdown", info: "Urgency", options: "Low, Medium, High, Critical" },
                    { name: "Status", column_type: "dropdown", info: "Resolution progress", options: "New, Assigned, In Progress, Waiting for User, Resolved" },
                ],
            },
        ],
    },
    {
        id: "property-rentals",
        name: "Property & Rental Management",
        description: "Manage buildings, rental units, tenant leases, and repair requests",
        category: "Real Estate",
        icon: "city",
        color: "emerald",
        tables: [
            {
                id: "properties",
                name: "Properties",
                description: "Real estate complexes, addresses, and property managers",
                icon: "building",
                color: "emerald",
                columns: [
                    { name: "Property Name", column_type: "text", info: "Building title", required: true },
                    { name: "Street Address", column_type: "text", info: "Street address" },
                    { name: "Property Type", column_type: "dropdown", info: "Category", options: "Apartment Building, Office Tower, Retail Plaza, Residential Complex" },
                    { name: "Total Units", column_type: "number", info: "Number of units" },
                ],
            },
            {
                id: "units",
                name: "Rental Units",
                description: "Apartments, monthly rent rates, and occupancy status",
                icon: "door-open",
                color: "blue",
                columns: [
                    { name: "Unit Number", column_type: "text", info: "Unit e.g. Apt 4B", required: true },
                    { name: "Property", column_type: "ref", info: "Belongs to building", target_group_table: "properties", target_column: "name", required: true },
                    { name: "Bedrooms", column_type: "number", info: "Bedroom count" },
                    { name: "Monthly Rent", column_type: "number", info: "Rent amount in USD" },
                    { name: "Status", column_type: "dropdown", info: "Occupancy", options: "Vacant, Leased, Maintenance, Reserved" },
                ],
            },
            {
                id: "tenants",
                name: "Tenants & Leases",
                description: "Lease agreements, tenant contact, and security deposits",
                icon: "file-signature",
                color: "amber",
                columns: [
                    { name: "Tenant Name", column_type: "text", info: "Primary lessee", required: true },
                    { name: "Unit", column_type: "ref", info: "Rented unit", target_group_table: "units", target_column: "name", required: true },
                    { name: "Email", column_type: "email", info: "Tenant email" },
                    { name: "Phone", column_type: "text", info: "Phone" },
                    { name: "Lease Start", column_type: "date", info: "Start date" },
                    { name: "Lease End", column_type: "date", info: "Expiration date" },
                ],
            },
            {
                id: "maintenance",
                name: "Maintenance Requests",
                description: "Tenant repair tickets, urgency, and contractor dispatch",
                icon: "screwdriver-wrench",
                color: "rose",
                columns: [
                    { name: "Unit", column_type: "ref", info: "Affected unit", target_group_table: "units", target_column: "name", required: true },
                    { name: "Issue Summary", column_type: "text", info: "Problem description", required: true },
                    { name: "Priority", column_type: "dropdown", info: "Urgency", options: "Routine, Medium, Urgent, Emergency" },
                    { name: "Status", column_type: "dropdown", info: "Resolution", options: "New, Scheduled, Parts On Order, Completed" },
                ],
            },
        ],
    },
    {
        id: "clinic-patients",
        name: "Clinic & Patient Care",
        description: "Patient records, attending physicians, appointment visits, and prescriptions",
        category: "Healthcare",
        icon: "hospital",
        color: "red",
        tables: [
            {
                id: "patients",
                name: "Patients",
                description: "Patient demographics, medical IDs, and emergency contacts",
                icon: "user-injured",
                color: "red",
                columns: [
                    { name: "Patient Name", column_type: "text", info: "Full legal name", required: true },
                    { name: "Medical Record #", column_type: "text", info: "MRN ID" },
                    { name: "Date of Birth", column_type: "date", info: "Birth date" },
                    { name: "Blood Type", column_type: "dropdown", info: "Blood group", options: "A+, A-, B+, B-, AB+, AB-, O+, O-" },
                    { name: "Phone", column_type: "text", info: "Contact phone" },
                ],
            },
            {
                id: "physicians",
                name: "Doctors & Staff",
                description: "Medical specialists, clinic rooms, and licenses",
                icon: "user-doctor",
                color: "blue",
                columns: [
                    { name: "Doctor Name", column_type: "text", info: "Physician name", required: true },
                    { name: "Specialty", column_type: "dropdown", info: "Medical field", options: "General Practice, Pediatrics, Cardiology, Orthopedics, Dermatology" },
                    { name: "Office Room", column_type: "text", info: "Clinic room number" },
                ],
            },
            {
                id: "appointments",
                name: "Appointments",
                description: "Scheduled patient visits, consultation dates, and triage",
                icon: "calendar-plus",
                color: "emerald",
                columns: [
                    { name: "Patient", column_type: "ref", info: "Visiting patient", target_group_table: "patients", target_column: "name", required: true },
                    { name: "Doctor", column_type: "ref", info: "Attending doctor", target_group_table: "physicians", target_column: "name" },
                    { name: "Date", column_type: "date", info: "Consultation date", required: true },
                    { name: "Time", column_type: "time", info: "Time of day" },
                    { name: "Status", column_type: "dropdown", info: "Visit state", options: "Scheduled, Checked-In, In Consultation, Completed, Cancelled" },
                ],
            },
            {
                id: "prescriptions",
                name: "Prescriptions",
                description: "Prescribed medicines, dosages, and treatment instructions",
                icon: "pills",
                color: "purple",
                columns: [
                    { name: "Patient", column_type: "ref", info: "Patient", target_group_table: "patients", target_column: "name", required: true },
                    { name: "Medication Name", column_type: "text", info: "Drug name", required: true },
                    { name: "Dosage", column_type: "text", info: "Dose e.g. 500mg twice daily" },
                    { name: "Duration", column_type: "text", info: "Duration e.g. 7 days" },
                ],
            },
        ],
    },
    {
        id: "publishing-editorial",
        name: "Editorial & Content Publishing",
        description: "Editorial pipeline for articles, author directory, publication channels, and tasks",
        category: "Media",
        icon: "newspaper",
        color: "violet",
        tables: [
            {
                id: "articles",
                name: "Articles",
                description: "Drafts, editorial review stages, and publication schedules",
                icon: "feather-pointed",
                color: "violet",
                columns: [
                    { name: "Headline", column_type: "text", info: "Article headline", required: true },
                    { name: "Topic Section", column_type: "dropdown", info: "Section", options: "Technology, Politics, Culture, Business, Science, Lifestyle" },
                    { name: "Status", column_type: "dropdown", info: "Editorial workflow", options: "Pitch, In Writing, Editor Review, Ready to Publish, Published" },
                    { name: "Publish Date", column_type: "date", info: "Scheduled date" },
                    { name: "Word Count", column_type: "number", info: "Article length" },
                ],
            },
            {
                id: "authors",
                name: "Authors & Writers",
                description: "Contributors, staff journalists, and freelancer roster",
                icon: "pen-nib",
                color: "blue",
                columns: [
                    { name: "Author Name", column_type: "text", info: "Byline name", required: true },
                    { name: "Role Type", column_type: "dropdown", info: "Contributor type", options: "Staff Writer, Columnist, Freelancer, Guest" },
                    { name: "Email", column_type: "email", info: "Email address" },
                ],
            },
            {
                id: "editorial-tasks",
                name: "Editorial Checklist",
                description: "Fact checking, photo permissions, copyediting, and SEO tasks",
                icon: "list-check",
                color: "amber",
                columns: [
                    { name: "Article", column_type: "ref", info: "Target article", target_group_table: "articles", target_column: "name", required: true },
                    { name: "Checklist Item", column_type: "dropdown", info: "Task type", options: "Fact Check, Copyedit, Graphic / Header Image, SEO Audit, Legal Review" },
                    { name: "Assigned To", column_type: "ref", info: "Assignee", target_group_table: "authors", target_column: "name" },
                    { name: "Complete", column_type: "checkbox", info: "Is verified" },
                ],
            },
        ],
    },
];

// Flat fallback table templates derived from groups for backwards compatibility
export const TABLE_TEMPLATES: TableTemplate[] = [
    {
        id: "blank",
        name: "Blank Table",
        description: "Start from scratch and build your own custom columns",
        icon: "table",
        color: "slate",
        columns: [],
    },
    ...TABLE_GROUP_TEMPLATES.flatMap(group => group.tables),
];

/**
 * Creates an entire group of tables in sequence and wires up relational references.
 */
export async function createTableGroup(
    group: TableGroupTemplate,
    onProgress?: (current: number, total: number, message: string) => void
): Promise<{ firstTableId: number | null; error?: string }> {
    const totalSteps = group.tables.length * 2;
    const createdMap: Record<string, number> = {};
    let firstTableId: number | null = null;

    try {
        // Pass 1: Create all datatables
        for (let i = 0; i < group.tables.length; i++) {
            const tbl = group.tables[i];
            onProgress?.(i + 1, totalSteps, `Creating table "${tbl.name}"...`);

            const res = await createDatatable({
                name: tbl.name,
                info: tbl.description,
                icon: tbl.icon,
                color: tbl.color || group.color,
            });

            if (res.error || !res.data) {
                return { firstTableId: null, error: res.error || `Failed to create table ${tbl.name}` };
            }

            createdMap[tbl.id] = res.data.id;
            createdMap[tbl.name] = res.data.id;

            if (firstTableId === null) {
                firstTableId = res.data.id;
            }
        }

        // Pass 2: Create columns and link relational references
        for (let i = 0; i < group.tables.length; i++) {
            const tbl = group.tables[i];
            const tableId = createdMap[tbl.id];
            if (!tableId) continue;

            onProgress?.(group.tables.length + i + 1, totalSteps, `Configuring columns for "${tbl.name}"...`);

            for (const col of tbl.columns) {
                let options = col.options || "";

                if ((col.column_type === "ref" || col.column_type === "multiref") && col.target_group_table) {
                    const targetId = createdMap[col.target_group_table];
                    if (targetId) {
                        options = JSON.stringify({
                            target_table_id: targetId,
                            identity_column: col.target_column || "name",
                        });
                    }
                }

                await createColumn({
                    table_id: tableId,
                    name: col.name,
                    column_type: col.column_type,
                    icon: col.icon || "",
                    info: col.info || "",
                    required: col.required || false,
                    options,
                });
            }
        }

        return { firstTableId };
    } catch (err: any) {
        return { firstTableId: null, error: err.message || "Failed to create table group" };
    }
}
