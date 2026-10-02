export const formatCents = (amountInCents: number, currencySymbol: string = '$'): string => {
    const isNegative = amountInCents < 0;
    const absVal = Math.abs(amountInCents) / 100;
    const formatted = absVal.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return isNegative ? `-${currencySymbol}${formatted}` : `${currencySymbol}${formatted}`;
};

export const formatDate = (dateVal: any): string => {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
        if (typeof dateVal === 'string' && dateVal.length >= 10) {
            return dateVal.substring(0, 10);
        }
        return String(dateVal);
    }
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const downloadCsv = (filename: string, rows: (string | number | boolean | null | undefined)[][]): void => {
    const processRow = (row: (string | number | boolean | null | undefined)[]) => {
        return row.map((val) => {
            if (val === null || val === undefined) return '""';
            let str = String(val);
            if (str.search(/("|,|\n)/g) >= 0) {
                str = `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(',');
    };

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(processRow).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const printReport = (): void => {
    window.print();
};
