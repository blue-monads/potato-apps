export interface TableTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    columns: {
        name: string;
        column_type: string;
        info?: string;
    }[];
}

export const TABLE_TEMPLATES: TableTemplate[] = [
    {
        id: "blank",
        name: "Blank",
        description: "Start with an empty table",
        icon: "table",
        columns: []
    },
    {
        id: "contacts",
        name: "Contacts",
        description: "Manage your contacts and relationships",
        icon: "address-book",
        columns: [
            { name: "Name", column_type: "text", info: "Full name" },
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
        description: "Track tasks and projects",
        icon: "tasks",
        columns: [
            { name: "Task", column_type: "text", info: "Task name" },
            { name: "Status", column_type: "dropdown", info: "Task status" },
            { name: "Priority", column_type: "dropdown", info: "Priority level" },
            { name: "Assignee", column_type: "text", info: "Assigned to" },
            { name: "Due Date", column_type: "date", info: "Due date" },
            { name: "Notes", column_type: "textarea", info: "Task notes" }
        ]
    },
    {
        id: "inventory",
        name: "Inventory",
        description: "Track products and stock",
        icon: "boxes",
        columns: [
            { name: "Product Name", column_type: "text", info: "Product name" },
            { name: "SKU", column_type: "text", info: "Stock keeping unit" },
            { name: "Quantity", column_type: "number", info: "Current quantity" },
            { name: "Price", column_type: "number", info: "Unit price" },
            { name: "Category", column_type: "text", info: "Product category" },
            { name: "Location", column_type: "text", info: "Storage location" }
        ]
    },
    {
        id: "events",
        name: "Events",
        description: "Manage events and schedules",
        icon: "calendar",
        columns: [
            { name: "Event Name", column_type: "text", info: "Event title" },
            { name: "Date", column_type: "date", info: "Event date" },
            { name: "Time", column_type: "text", info: "Event time" },
            { name: "Location", column_type: "text", info: "Event location" },
            { name: "Attendees", column_type: "text", info: "Number of attendees" },
            { name: "Status", column_type: "dropdown", info: "Event status" }
        ]
    },
    {
        id: "expenses",
        name: "Expenses",
        description: "Track expenses and receipts",
        icon: "receipt",
        columns: [
            { name: "Description", column_type: "text", info: "Expense description" },
            { name: "Amount", column_type: "number", info: "Expense amount" },
            { name: "Category", column_type: "dropdown", info: "Expense category" },
            { name: "Date", column_type: "date", info: "Expense date" },
            { name: "Payment Method", column_type: "dropdown", info: "How it was paid" },
            { name: "Receipt", column_type: "file", info: "Receipt file" }
        ]
    },
    {
        id: "notes",
        name: "Notes",
        description: "Simple note-taking table",
        icon: "sticky-note",
        columns: [
            { name: "Title", column_type: "text", info: "Note title" },
            { name: "Content", column_type: "textarea", info: "Note content" },
            { name: "Tags", column_type: "multiselect", info: "Tags" },
            { name: "Created", column_type: "date", info: "Creation date" }
        ]
    }
];


