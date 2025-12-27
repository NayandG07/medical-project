/**
 * Admin Maintenance Control Page
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */
import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import MaintenanceControl from '../../components/MaintenanceControl';

export default function MaintenancePage() {
  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Maintenance Control</h1>
        <MaintenanceControl />
      </div>
    </AdminLayout>
  );
}
