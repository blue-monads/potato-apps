
-- ACCOUNTING 

create table Accounts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    info TEXT NOT NULL DEFAULT '',
    acc_type TEXT NOT NULL DEFAULT 'expenses', -- expenses, revenue, assets, liabilities, equity
    parent_id INTEGER NOT NULL DEFAULT 0,
    total_debit INTEGER NOT NULL DEFAULT 0,
    total_credit INTEGER NOT NULL DEFAULT 0,
    contact_id INTEGER NOT NULL DEFAULT 0,
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

create table Transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    txn_type TEXT NOT NULL DEFAULT 'normal', -- manual, sales, stockin
    reference_id TEXT NOT NULL DEFAULT '',
    attachments TEXT NOT NULL DEFAULT '',
    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,
    txn_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_editable BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

create table TransactionLines(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    txn_id INTEGER NULL,
    debit_amount INTEGER NOT NULL DEFAULT 0,
    credit_amount INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    linked_sales_id INTEGER NOT NULL DEFAULT 0,
    linked_stockin_id INTEGER NOT NULL DEFAULT 0
);



-- Estimates has not direct link to Txn, it will be used as template to create actual sales

-- z_1_Estimates
create table Estimates(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    client_id INTEGER NOT NULL DEFAULT 0,
    client_name TEXT NOT NULL DEFAULT '',

    notes TEXT NOT NULL DEFAULT '',
    attachments TEXT NOT NULL DEFAULT '',

    total_item_price INTEGER NOT NULL DEFAULT 0,
    total_item_tax_amount INTEGER NOT NULL DEFAULT 0,
    total_item_discount_amount INTEGER NOT NULL DEFAULT 0,

    sub_total INTEGER NOT NULL DEFAULT 0, -- total_item_price + total_item_tax_amount - total_item_discount_amount

    overall_discount_amount INTEGER NOT NULL DEFAULT 0,
    overall_tax_amount INTEGER NOT NULL DEFAULT 0,
    
    total INTEGER NOT NULL DEFAULT 0, -- sub_total +  overall_tax_amount - overall_discount_amount
    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,    
    sales_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

create table EstimateLines(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    info TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 0,    
    estimate_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL DEFAULT 0,

    price INTEGER NOT NULL DEFAULT 0, -- original item price
    tax_amount INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,

    total_amount INTEGER NOT NULL DEFAULT 0, -- total_amount = item_price + item_tax_amount - discount_amount
    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);




-- INVENTORY

create table Catagories(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    info TEXT NOT NULL DEFAULT '',
    product_class TEXT NOT NULL DEFAULT 'physical_item', -- physical_item, service, digital_item        
    parent_id INTEGER NOT NULL DEFAULT 0,
    image TEXT NOT NULL DEFAULT '',
    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);


create table Products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    info TEXT NOT NULL DEFAULT '',
    catagory_id INTEGER NOT NULL DEFAULT 0,
    sales_price INTEGER NOT NULL DEFAULT 0,
    image TEXT NOT NULL DEFAULT '',
    images TEXT NOT NULL DEFAULT '',
    alt_images TEXT NOT NULL DEFAULT '',
    epoch INTEGER NOT NULL DEFAULT 0, -- optimistic counter for stock count
    stock_count INTEGER NOT NULL DEFAULT 0, 

    -- track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    -- sales_account_id INTEGER,
    -- purchase_account_id INTEGER,
    -- tax_id INTEGER,


    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

create table ProductVariants(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    sales_price INTEGER NOT NULL DEFAULT 0,
    -- stock_count INTEGER NOT NULL DEFAULT 0, 
    
    images TEXT NOT NULL DEFAULT '',
    created_by INTEGER NOT NULL DEFAULT 0,
    updated_by INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);


create table ProductStockIn(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    info TEXT NOT NULL DEFAULT '',
    amount INTEGER NOT NULL DEFAULT 0,
    vendor_id INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

create table ProductStockInLines(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    info TEXT NOT NULL DEFAULT '',
    product_stockin_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0,
    amount INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- SALES

create table Sales(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    client_id INTEGER NOT NULL DEFAULT 0,
    client_name TEXT NOT NULL DEFAULT '',

    notes TEXT NOT NULL DEFAULT '',
    attachments TEXT NOT NULL DEFAULT '',

    total_item_price INTEGER NOT NULL DEFAULT 0,
    total_item_tax_amount INTEGER NOT NULL DEFAULT 0,
    total_item_discount_amount INTEGER NOT NULL DEFAULT 0,

    sub_total INTEGER NOT NULL DEFAULT 0, -- total_item_price + total_item_tax_amount - total_item_discount_amount

    overall_discount_amount INTEGER NOT NULL DEFAULT 0,
    overall_tax_amount INTEGER NOT NULL DEFAULT 0,
    
    total INTEGER NOT NULL DEFAULT 0, -- sub_total +  overall_tax_amount - overall_discount_amount
    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,    
    sales_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invalidated_reason TEXT NOT NULL DEFAULT '',
    payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, paid, partially_paid, refunded

    -- reference_id TEXT ,
    -- reference_type TEXT , -- extern_id

    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);


create table SalesLines(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    info TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 0,    
    sale_id INTEGER NOT NULL,
    product_id INTEGER,
    variant_id INTEGER,

    price INTEGER NOT NULL DEFAULT 0, -- original item price
    tax_amount INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,

    total_amount INTEGER NOT NULL DEFAULT 0, -- total_amount = item_price + item_tax_amount - discount_amount
    -- reference_id TEXT ,
    -- reference_type TEXT , -- extern_id

    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


create table Tax(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    ttype TEXT NOT NULL DEFAULT 'sales', -- sales, purchase
    info TEXT NOT NULL DEFAULT '',
    rate INTEGER NOT NULL DEFAULT 0,
    "strict" BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);



