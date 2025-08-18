
import { Transaction, Account } from '../types';

const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const exportTransactionsToCSV = (transactions: Transaction[]) => {
    if (transactions.length === 0) {
        console.warn("No transactions to export.");
        return;
    }
    const headers = "id,date,description,amount,category,accountName";
    const rows = transactions.map(t =>
        [t.id, t.date, `"${t.description.replace(/"/g, '""')}"`, t.amount, t.category, t.accountName || ''].join(',')
    ).join('\n');

    const csvContent = `${headers}\n${rows}`;
    downloadCSV(csvContent, 'fintrack-transactions.csv');
};

export const exportAccountsToCSV = (accounts: Account[]) => {
    if (accounts.length === 0) {
        console.warn("No accounts to export.");
        return;
    }
    const headers = "id,name,category,institution,balance";
    const rows = accounts.map(acc =>
        [acc.id, `"${acc.name.replace(/"/g, '""')}"`, acc.category, `"${acc.institution?.replace(/"/g, '""') || ''}"`, acc.balance].join(',')
    ).join('\n');

    const csvContent = `${headers}\n${rows}`;
    downloadCSV(csvContent, 'fintrack-accounts.csv');
};
