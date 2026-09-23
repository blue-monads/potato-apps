export interface TableTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    color?: string;
    columns: {
        name: string;
        column_type: string;
        info?: string;
        required?: boolean;
        options?: string;
    }[];
}

export const TABLE_TEMPLATES: TableTemplate[] = [
    {
        id: "blank",
        name: "Blank Table",
        description: "Start from scratch and build your own custom columns",
        icon: "table",
        color: "slate",
        columns: []
    },
    {
        id: "contacts",
        name: "Contacts",
        description: "Manage your contacts, clients, and relationships",
        icon: "address-book",
        color: "blue",
        columns: [
            { name: "Name", column_type: "text", info: "Full name", required: true },
            { name: "Email", column_type: "text", info: "Email address" },
            { name: "Phone", column_type: "text", info: "Phone number" },
            { name: "Company", column_type: "text", info: "Company name" },
            { name: "Role", column_type: "text", info: "Job title or role" },
            { name: "Notes", column_type: "textarea", info: "Additional notes" }
        ]
    },
    {
        id: "tasks",
        name: "Task Tracker",
        description: "Track tasks, assignments, deadlines, and project statuses",
        icon: "tasks",
        color: "emerald",
        columns: [
            { name: "Task", column_type: "text", info: "Task name", required: true },
            { name: "Status", column_type: "dropdown", info: "Task status", options: "Todo, In Progress, Review, Done" },
            { name: "Priority", column_type: "dropdown", info: "Priority level", options: "Low, Medium, High, Urgent" },
            { name: "Assignee", column_type: "text", info: "Assigned person" },
            { name: "Due Date", column_type: "date", info: "Due date" },
            { name: "Estimated Time", column_type: "duration", info: "Estimated duration" },
            { name: "Notes", column_type: "textarea", info: "Task notes" }
        ]
    },
    {
        id: "inventory",
        name: "Inventory",
        description: "Track products, stock levels, pricing, and storage locations",
        icon: "boxes",
        color: "amber",
        columns: [
            { name: "Product Name", column_type: "text", info: "Product name", required: true },
            { name: "SKU", column_type: "text", info: "Stock keeping unit" },
            { name: "Quantity", column_type: "number", info: "Current quantity" },
            { name: "Price", column_type: "number", info: "Unit price" },
            { name: "Category", column_type: "dropdown", info: "Product category", options: "Electronics, Clothing, Groceries, Hardware, Books" },
            { name: "Location", column_type: "text", info: "Storage location" }
        ]
    },
    {
        id: "events",
        name: "Events",
        description: "Manage events, conferences, attendees, and schedules",
        icon: "calendar",
        color: "violet",
        columns: [
            { name: "Event Name", column_type: "text", info: "Event title", required: true },
            { name: "Date", column_type: "date", info: "Event date" },
            { name: "Time", column_type: "time", info: "Event time" },
            { name: "Location", column_type: "text", info: "Event location" },
            { name: "Attendees", column_type: "number", info: "Expected attendees" },
            { name: "Status", column_type: "dropdown", info: "Event status", options: "Planning, Scheduled, Confirmed, Completed, Cancelled" }
        ]
    },
    {
        id: "expenses",
        name: "Expenses",
        description: "Track expenses, payment methods, receipts, and budgets",
        icon: "receipt",
        color: "rose",
        columns: [
            { name: "Description", column_type: "text", info: "Expense description", required: true },
            { name: "Amount", column_type: "number", info: "Expense amount" },
            { name: "Category", column_type: "dropdown", info: "Expense category", options: "Travel, Meals, Office Supplies, Software, Utilities, Other" },
            { name: "Date", column_type: "date", info: "Expense date" },
            { name: "Payment Method", column_type: "dropdown", info: "How it was paid", options: "Credit Card, Debit Card, Cash, Bank Transfer, PayPal" },
            { name: "Receipt", column_type: "file", info: "Receipt file" }
        ]
    },
    {
        id: "notes",
        name: "Notes",
        description: "Capture quick notes, ideas, tags, and documentation",
        icon: "sticky-note",
        color: "cyan",
        columns: [
            { name: "Title", column_type: "text", info: "Note title", required: true },
            { name: "Content", column_type: "textarea", info: "Note content" },
            { name: "Tags", column_type: "multiselect", info: "Tags", options: "Idea, Personal, Work, Project, Urgent, Draft" },
            { name: "Created", column_type: "date", info: "Creation date" }
        ]
    }
];


