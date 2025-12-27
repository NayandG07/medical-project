/**
 * Admin Provider Health Dashboard Page
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */
import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ProviderHealthTable from '../../components/ProviderHealthTable';

export default function ProviderHealthPage() {
  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Provider Health Dashboard</h1>
        <ProviderHealthTable />
      </div>
    </AdminLayout>
  );
}
