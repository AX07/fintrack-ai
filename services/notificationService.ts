import { AppNotification, Currency } from '../types';

const mockVendors = [
    { name: "Uber Ride", category: "Transport" },
    { name: "Starbucks", category: "Food" },
    { name: "Amazon Purchase", category: "Other" },
    { name: "Netflix Subscription", category: "Entertainment" },
    { name: "Whole Foods", category: "Food" },
    { name: "Exxon Mobil Gas", category: "Transport" },
    { name: "Con Edison", category: "Utilities" },
];

let generatedNotifications: AppNotification[] | null = null;

// This function generates a list of notifications once and then returns the cached list
// to simulate a persistent notification tray.
export const getNotifications = (): AppNotification[] => {
    if (generatedNotifications) {
        return generatedNotifications;
    }

    const notifications: AppNotification[] = [];
    const now = new Date();

    for (let i = 0; i < 5; i++) {
        const vendor = mockVendors[Math.floor(Math.random() * mockVendors.length)];
        const amount = parseFloat((Math.random() * (100 - 5) + 5).toFixed(2));
        const currency: Currency = ['USD', 'EUR', 'GBP'][Math.floor(Math.random() * 3)] as Currency;
        
        notifications.push({
            id: `notif-${Date.now()}-${i}`,
            source: "Simulated Payment",
            description: vendor.name,
            amount: amount,
            currency: currency,
            timestamp: new Date(now.getTime() - i * 60 * 60 * 1000).toISOString(), // Notifications spaced by an hour
            read: i > 2, // Mark some as already read
        });
    }

    generatedNotifications = notifications.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return generatedNotifications;
};
