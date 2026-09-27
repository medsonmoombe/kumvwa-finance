import { useCallback, useEffect, useState } from 'react';
import { FiPlus } from 'react-icons/fi';

import { Badge, ErrorBox } from '../../components/ui';
import {
  AppTable, Drawer, PageActionBar, Pill, type Column,
} from '../../components/kit';
import { api } from '../../lib/api';
import { ProductForm } from './ProductFormPage';

interface Product {
  id: string; code: string | null; name: string;
  rateBps: number; minAmount: number; maxAmount: number;
  minTerm: number; maxTerm: number; frequency: string;
  repaymentStructure: string; originationFeeBps: number;
  feeTreatment: string; penaltyBpsPerDay: number; active: boolean;
}

export function ProductsPage() {
  const [rows, setRows] = useState<Product[] | null>(null);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ items: Product[] }>('/loan-products')
      .then((r) => setRows(r.data.items))
      .catch(() => setError('Could not load loan products'));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditId(null); setDrawerOpen(true); }
  function openEdit(id: string) { setEditId(id); setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); setEditId(null); }
  function onSaved() { closeDrawer(); load(); }

  const visible = rows?.filter((p) => filter === 'all' || p.active) ?? null;

  const columns: Array<Column<Product>> = [
    {
      key: 'name', header: 'Product', width: '22%',
      render: (p) => (
        <div>
          <b className="block font-semibold">{p.name}</b>
          <span className="text-[10.5px] text-ink-muted">{p.code ?? 'no code'}</span>
        </div>
      ),
    },
    {
      key: 'rate', header: 'Interest (flat)',
      render: (p) => <span className="tabular-nums">{(p.rateBps / 100).toFixed(1)}%</span>,
    },
    {
      key: 'limits', header: 'Amount range',
      render: (p) => (
        <span className="tabular-nums">
          K {p.minAmount.toLocaleString()} – K {p.maxAmount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'term', header: 'Term',
      render: (p) => <span className="tabular-nums">{p.minTerm}–{p.maxTerm} mo</span>,
    },
    {
      key: 'structure', header: 'Repayment',
      render: (p) => (
        <span className="capitalize">
          {p.repaymentStructure === 'bullet' ? 'Bullet / chunks' : `${p.frequency} installments`}
        </span>
      ),
    },
    {
      key: 'fee', header: 'Fee',
      render: (p) => (
        <span className="tabular-nums">
          {p.originationFeeBps > 0 ? `${(p.originationFeeBps / 100).toFixed(1)}% ${p.feeTreatment}` : 'None'}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (p) => <Badge color={p.active ? 'green' : 'grey'} dot>{p.active ? 'Active' : 'Inactive'}</Badge>,
    },
  ];

  return (
    <div>
      <PageActionBar
        title="Loan Products"
        sub="What your clients can borrow, at what terms. Rules here bound every application."
        actions={<Pill onClick={openNew}><FiPlus size={11} /> Create Product</Pill>}
      />

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      <AppTable
        columns={columns}
        rows={visible}
        filters={[
          { value: 'active', label: 'Active' },
          { value: 'all', label: 'All' },
        ]}
        activeFilter={filter}
        onFilterChange={(v) => setFilter(v as 'active' | 'all')}
        onRefresh={load}
        actions={(_p) => [
          { label: 'Edit product', onClick: (row) => openEdit(row.id) },
        ]}
        empty="No products yet. Create your first product to start lending."
        pageSize={20}
      />

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editId ? 'Edit Product' : 'Create Loan Product'}
        sub={editId ? undefined : 'New product — enforces on every application once saved'}
        width={560}
      >
        {drawerOpen && (
          <ProductForm
            id={editId ?? undefined}
            onSaved={onSaved}
            onCancel={closeDrawer}
          />
        )}
      </Drawer>
    </div>
  );
}
