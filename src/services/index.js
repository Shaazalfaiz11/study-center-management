// ============================================================
// SERVICE LAYER — single entry point
// ------------------------------------------------------------
// Components import from here and never touch the mock data
// directly. Swapping these for real REST calls later means
// changing only the bodies of these modules — the UI contract
// (promise in, plain object out) stays identical.
// ============================================================

export { default as studentService } from './studentService';
export { default as seatService } from './seatService';
export { default as membershipService } from './membershipService';
export { default as paymentService } from './paymentService';
export { default as assignmentService } from './assignmentService';
export { default as attendanceService } from './attendanceService';
export { default as reportService, exportToCsv, exportDailyOperationsCsv, printReport } from './reportService';
export { default as auditService, setActor } from './auditService';
export { default as searchService, globalSearch } from './searchService';
export { maintenanceService, expenseService, slotService, notificationService } from './operationsService';

export * from './businessRules';
export { getState, subscribe, simulateNextFailure } from './store';
