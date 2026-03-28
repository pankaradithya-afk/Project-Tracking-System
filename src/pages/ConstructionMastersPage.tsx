import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { ERPFormModal, type ERPFieldConfig } from '@/components/erp/ERPFormModal'
import { ERPSection } from '@/components/erp/ERPSection'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatCurrency } from '@/lib/utils'
import { buildOptionLabel, createRecord, deleteRecord, getMastersSnapshot, listRecords, toNullable, updateRecord, toNumber } from '@/services/constructionErpService'
import type { ERPClient, ERPCostCode, ERPDepartment, ERPItem, ERPProjectBudget, ERPRole, ERPUserDirectory } from '@/types/constructionErp'

type SectionKey = 'clients' | 'items' | 'costCodes' | 'users' | 'departments' | 'roles' | 'budgets'
type ProfileOption = { id: string; full_name: string | null; email: string }

const emptyForm = {
    client_code: '',
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gst_no: '',
    item_code: '',
    item_type: 'material',
    uom: '',
    standard_rate: '0',
    hsn_code: '',
    is_active: 'true',
    code: '',
    description: '',
    category: 'material',
    profile_id: '',
    employee_code: '',
    full_name: '',
    role_id: '',
    department_id: '',
    project_id: '',
    cost_code_id: '',
    budget_amount: '0',
}

export default function ConstructionMastersPage() {
    const qc = useQueryClient()
    const [modalSection, setModalSection] = useState<SectionKey | null>(null)
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<Record<string, string>>(emptyForm)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['construction-erp-masters'],
        queryFn: getMastersSnapshot,
    })

    const { data: profiles = [] } = useQuery({
        queryKey: ['construction-erp-profile-options'],
        queryFn: async () => listRecords<ProfileOption>('profiles', {
            select: 'id, full_name, email',
            orderBy: 'full_name',
            ascending: true,
        }),
    })

    const clients = data?.clients ?? []
    const items = data?.items ?? []
    const costCodes = data?.costCodes ?? []
    const users = data?.users ?? []
    const departments = data?.departments ?? []
    const roles = data?.roles ?? []
    const budgets = data?.budgets ?? []
    const projects = data?.projects ?? []

    const roleMap = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles])
    const departmentMap = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments])
    const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects])
    const costCodeMap = useMemo(() => new Map(costCodes.map((costCode) => [costCode.id, `${costCode.code} - ${costCode.description}`])), [costCodes])

    const closeModal = () => {
        setModalSection(null)
        setModalMode('create')
        setEditingId(null)
        setForm(emptyForm)
        setError('')
    }

    const setSectionForm = (section: SectionKey, values: Record<string, string>, id?: string) => {
        setModalSection(section)
        setModalMode(id ? 'edit' : 'create')
        setEditingId(id ?? null)
        setForm({ ...emptyForm, ...values })
        setError('')
    }

    const openCreate = (section: SectionKey) => setSectionForm(section, {})

    const handleFieldChange = (name: string, value: string) => {
        if (modalSection === 'users' && name === 'profile_id') {
            const selectedProfile = profiles.find((profile) => profile.id === value)
            setForm((current) => ({
                ...current,
                profile_id: value,
                full_name: selectedProfile?.full_name ?? current.full_name,
                email: selectedProfile?.email ?? current.email,
            }))
            return
        }

        setForm((current) => ({ ...current, [name]: value }))
    }

    const handleDelete = async (section: SectionKey, id: string) => {
        const tableMap: Record<SectionKey, string> = {
            clients: 'clients',
            items: 'items',
            costCodes: 'cost_codes',
            users: 'users',
            departments: 'departments',
            roles: 'roles',
            budgets: 'project_cost_code_budgets',
        }

        if (!window.confirm('Delete this record?')) return
        await deleteRecord(tableMap[section], id)
        await qc.invalidateQueries({ queryKey: ['construction-erp-masters'] })
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!modalSection) return

        setSaving(true)
        setError('')

        try {
            if (modalSection === 'clients') {
                const payload = {
                    client_code: form.client_code,
                    name: form.name,
                    contact_person: toNullable(form.contact_person),
                    phone: toNullable(form.phone),
                    email: toNullable(form.email),
                    address: toNullable(form.address),
                    gst_no: toNullable(form.gst_no),
                }
                if (editingId) await updateRecord<ERPClient>('clients', editingId, payload)
                else await createRecord<ERPClient>('clients', payload)
            }

            if (modalSection === 'items') {
                const payload = {
                    item_code: form.item_code,
                    name: form.name,
                    item_type: form.item_type,
                    uom: form.uom,
                    standard_rate: toNumber(form.standard_rate),
                    hsn_code: toNullable(form.hsn_code),
                    is_active: form.is_active === 'true',
                }
                if (editingId) await updateRecord<ERPItem>('items', editingId, payload)
                else await createRecord<ERPItem>('items', payload)
            }

            if (modalSection === 'costCodes') {
                const payload = {
                    code: form.code,
                    description: form.description,
                    category: form.category,
                }
                if (editingId) await updateRecord<ERPCostCode>('cost_codes', editingId, payload)
                else await createRecord<ERPCostCode>('cost_codes', payload)
            }

            if (modalSection === 'users') {
                const payload = {
                    profile_id: form.profile_id,
                    employee_code: toNullable(form.employee_code),
                    full_name: form.full_name,
                    email: form.email,
                    phone: toNullable(form.phone),
                    role_id: toNullable(form.role_id),
                    department_id: toNullable(form.department_id),
                    is_active: form.is_active === 'true',
                }
                if (editingId) await updateRecord<ERPUserDirectory>('users', editingId, payload)
                else await createRecord<ERPUserDirectory>('users', payload)
            }

            if (modalSection === 'departments') {
                const payload = {
                    code: form.code,
                    name: form.name,
                    description: toNullable(form.description),
                }
                if (editingId) await updateRecord<ERPDepartment>('departments', editingId, payload)
                else await createRecord<ERPDepartment>('departments', payload)
            }

            if (modalSection === 'roles') {
                const payload = {
                    code: form.code,
                    name: form.name,
                    description: toNullable(form.description),
                }
                if (editingId) await updateRecord<ERPRole>('roles', editingId, payload)
                else await createRecord<ERPRole>('roles', payload)
            }

            if (modalSection === 'budgets') {
                const payload = {
                    project_id: form.project_id,
                    cost_code_id: form.cost_code_id,
                    budget_amount: toNumber(form.budget_amount),
                }
                if (editingId) await updateRecord<ERPProjectBudget>('project_cost_code_budgets', editingId, payload)
                else await createRecord<ERPProjectBudget>('project_cost_code_budgets', payload)
            }

            await qc.invalidateQueries({ queryKey: ['construction-erp-masters'] })
            closeModal()
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Unable to save record.')
        } finally {
            setSaving(false)
        }
    }

    const fields: Record<SectionKey, ERPFieldConfig[]> = {
        clients: [
            { name: 'client_code', label: 'Client Code', required: true },
            { name: 'name', label: 'Client Name', required: true },
            { name: 'contact_person', label: 'Contact Person' },
            { name: 'phone', label: 'Phone' },
            { name: 'email', label: 'Email' },
            { name: 'gst_no', label: 'GST No' },
            { name: 'address', label: 'Address', type: 'textarea', colSpan: 2 },
        ],
        items: [
            { name: 'item_code', label: 'Item Code', required: true },
            { name: 'name', label: 'Item Name', required: true },
            {
                name: 'item_type',
                label: 'Item Type',
                type: 'select',
                required: true,
                options: [
                    { label: 'Material', value: 'material' },
                    { label: 'Service', value: 'service' },
                ],
            },
            { name: 'uom', label: 'UOM', required: true },
            { name: 'standard_rate', label: 'Standard Rate', type: 'number', min: 0, step: 0.01, required: true },
            { name: 'hsn_code', label: 'HSN / SAC' },
            {
                name: 'is_active',
                label: 'Active',
                type: 'select',
                required: true,
                options: [
                    { label: 'Yes', value: 'true' },
                    { label: 'No', value: 'false' },
                ],
            },
        ],
        costCodes: [
            { name: 'code', label: 'Cost Code', required: true },
            { name: 'description', label: 'Description', required: true },
            {
                name: 'category',
                label: 'Category',
                type: 'select',
                required: true,
                options: [
                    { label: 'Material', value: 'material' },
                    { label: 'Labour', value: 'labour' },
                    { label: 'Machinery', value: 'machinery' },
                    { label: 'Fuel', value: 'fuel' },
                    { label: 'Subcontract', value: 'subcontract' },
                ],
            },
        ],
        users: [
            {
                name: 'profile_id',
                label: 'Profile',
                type: 'select',
                required: true,
                disabled: modalMode === 'edit',
                options: profiles.map((profile) => ({
                    value: profile.id,
                    label: buildOptionLabel(profile.full_name ?? profile.email, profile.email),
                })),
            },
            { name: 'employee_code', label: 'Employee Code' },
            { name: 'full_name', label: 'Full Name', required: true },
            { name: 'email', label: 'Email', required: true },
            { name: 'phone', label: 'Phone' },
            {
                name: 'role_id',
                label: 'Role',
                type: 'select',
                options: roles.map((role) => ({ value: role.id, label: role.name })),
            },
            {
                name: 'department_id',
                label: 'Department',
                type: 'select',
                options: departments.map((department) => ({ value: department.id, label: department.name })),
            },
            {
                name: 'is_active',
                label: 'Active',
                type: 'select',
                required: true,
                options: [
                    { label: 'Yes', value: 'true' },
                    { label: 'No', value: 'false' },
                ],
            },
        ],
        departments: [
            { name: 'code', label: 'Department Code', required: true },
            { name: 'name', label: 'Department Name', required: true },
            { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
        ],
        roles: [
            { name: 'code', label: 'Role Code', required: true },
            { name: 'name', label: 'Role Name', required: true },
            { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
        ],
        budgets: [
            {
                name: 'project_id',
                label: 'Project',
                type: 'select',
                required: true,
                options: projects.map((project) => ({ value: project.id, label: project.name })),
            },
            {
                name: 'cost_code_id',
                label: 'Cost Code',
                type: 'select',
                required: true,
                options: costCodes.map((costCode) => ({ value: costCode.id, label: `${costCode.code} - ${costCode.description}` })),
            },
            { name: 'budget_amount', label: 'Budget Amount', type: 'number', min: 0, step: 0.01, required: true },
        ],
    }

    const modalTitle = modalSection ? `${modalMode === 'edit' ? 'Edit' : 'Create'} ${({
        clients: 'Client',
        items: 'Item',
        costCodes: 'Cost Code',
        users: 'User',
        departments: 'Department',
        roles: 'Role',
        budgets: 'Project Budget',
    }[modalSection])}` : ''

    if (!data && isLoading) {
        return <div className="glass-card p-8 text-center text-sm" style={{ color: 'var(--color-surface-400)' }}>Loading construction ERP masters...</div>
    }

    return (
        <div className="space-y-6">
            <div className="glass-card p-5">
                <p className="text-sm leading-6" style={{ color: 'var(--color-surface-300)' }}>
                    Maintain the shared construction ERP masters here. Every downstream transaction uses these records for foreign-key integrity, dashboard rollups, and document linking.
                </p>
            </div>

            {profiles.length === 0 ? (
                <div className="glass-card p-4 flex items-center gap-3">
                    <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                    <p className="text-sm" style={{ color: 'var(--color-surface-400)' }}>No profiles were found. User directory creation needs existing authenticated profiles.</p>
                </div>
            ) : null}

            <ERPSection
                title="Clients"
                subtitle={`${clients.length} client records`}
                addLabel="New Client"
                data={clients}
                loading={isLoading}
                columns={[
                    { key: 'client_code', header: 'Code', sortable: true },
                    { key: 'name', header: 'Client Name', sortable: true },
                    { key: 'contact_person', header: 'Contact' },
                    { key: 'phone', header: 'Phone' },
                    { key: 'gst_no', header: 'GST No' },
                ]}
                filterKeys={['client_code', 'name']}
                onAdd={() => openCreate('clients')}
                onEdit={(record) => setSectionForm('clients', {
                    client_code: record.client_code,
                    name: record.name,
                    contact_person: record.contact_person ?? '',
                    phone: record.phone ?? '',
                    email: record.email ?? '',
                    address: record.address ?? '',
                    gst_no: record.gst_no ?? '',
                }, record.id)}
                onDelete={(record) => void handleDelete('clients', record.id)}
            />

            <ERPSection
                title="Items"
                subtitle={`${items.length} materials and service items`}
                addLabel="New Item"
                data={items}
                loading={isLoading}
                columns={[
                    { key: 'item_code', header: 'Code', sortable: true },
                    { key: 'name', header: 'Item', sortable: true },
                    { key: 'item_type', header: 'Type', render: (value: string) => <StatusBadge status={value} /> },
                    { key: 'uom', header: 'UOM' },
                    { key: 'standard_rate', header: 'Std Rate', render: (value: number) => formatCurrency(value) },
                    { key: 'is_active', header: 'Active', render: (value: boolean) => <StatusBadge status={value ? 'Approved' : 'Rejected'} /> },
                ]}
                filterKeys={['item_code', 'name']}
                onAdd={() => openCreate('items')}
                onEdit={(record) => setSectionForm('items', {
                    item_code: record.item_code,
                    name: record.name,
                    item_type: record.item_type,
                    uom: record.uom,
                    standard_rate: String(record.standard_rate),
                    hsn_code: record.hsn_code ?? '',
                    is_active: String(record.is_active),
                }, record.id)}
                onDelete={(record) => void handleDelete('items', record.id)}
            />

            <ERPSection
                title="Cost Codes"
                subtitle={`${costCodes.length} cost buckets for project control`}
                addLabel="New Cost Code"
                data={costCodes}
                loading={isLoading}
                columns={[
                    { key: 'code', header: 'Code', sortable: true },
                    { key: 'description', header: 'Description', sortable: true },
                    { key: 'category', header: 'Category', render: (value: string) => <StatusBadge status={value} /> },
                ]}
                filterKeys={['code', 'description']}
                onAdd={() => openCreate('costCodes')}
                onEdit={(record) => setSectionForm('costCodes', {
                    code: record.code,
                    description: record.description,
                    category: record.category,
                }, record.id)}
                onDelete={(record) => void handleDelete('costCodes', record.id)}
            />

            <ERPSection
                title="Users"
                subtitle={`${users.length} mapped ERP user records`}
                addLabel="New User"
                data={users}
                loading={isLoading}
                columns={[
                    { key: 'employee_code', header: 'Emp Code', sortable: true },
                    { key: 'full_name', header: 'Name', sortable: true },
                    { key: 'email', header: 'Email', sortable: true },
                    { key: 'role_id', header: 'Role', render: (value: string | null) => value ? roleMap.get(value) ?? 'Role' : 'Unassigned' },
                    { key: 'department_id', header: 'Department', render: (value: string | null) => value ? departmentMap.get(value) ?? 'Department' : 'Unassigned' },
                    { key: 'is_active', header: 'Active', render: (value: boolean) => <StatusBadge status={value ? 'Approved' : 'Rejected'} /> },
                ]}
                filterKeys={['employee_code', 'full_name', 'email']}
                onAdd={() => openCreate('users')}
                onEdit={(record) => setSectionForm('users', {
                    profile_id: record.profile_id,
                    employee_code: record.employee_code ?? '',
                    full_name: record.full_name,
                    email: record.email,
                    phone: record.phone ?? '',
                    role_id: record.role_id ?? '',
                    department_id: record.department_id ?? '',
                    is_active: String(record.is_active),
                }, record.id)}
                onDelete={(record) => void handleDelete('users', record.id)}
            />

            <div className="grid gap-6 xl:grid-cols-2">
                <ERPSection
                    title="Departments"
                    subtitle={`${departments.length} departments`}
                    addLabel="New Department"
                    data={departments}
                    loading={isLoading}
                    columns={[
                        { key: 'code', header: 'Code', sortable: true },
                        { key: 'name', header: 'Name', sortable: true },
                        { key: 'description', header: 'Description' },
                    ]}
                    filterKeys={['code', 'name']}
                    onAdd={() => openCreate('departments')}
                    onEdit={(record) => setSectionForm('departments', {
                        code: record.code,
                        name: record.name,
                        description: record.description ?? '',
                    }, record.id)}
                    onDelete={(record) => void handleDelete('departments', record.id)}
                />

                <ERPSection
                    title="Roles"
                    subtitle={`${roles.length} role definitions`}
                    addLabel="New Role"
                    data={roles}
                    loading={isLoading}
                    columns={[
                        { key: 'code', header: 'Code', sortable: true },
                        { key: 'name', header: 'Role', sortable: true },
                        { key: 'description', header: 'Description' },
                    ]}
                    filterKeys={['code', 'name']}
                    onAdd={() => openCreate('roles')}
                    onEdit={(record) => setSectionForm('roles', {
                        code: record.code,
                        name: record.name,
                        description: record.description ?? '',
                    }, record.id)}
                    onDelete={(record) => void handleDelete('roles', record.id)}
                />
            </div>

            <ERPSection
                title="Project Budgets"
                subtitle={`${budgets.length} project/cost-code budgets used by the dashboard`}
                addLabel="New Budget"
                data={budgets}
                loading={isLoading}
                columns={[
                    { key: 'project_id', header: 'Project', render: (value: string) => projectMap.get(value) ?? value, sortable: true },
                    { key: 'cost_code_id', header: 'Cost Code', render: (value: string) => costCodeMap.get(value) ?? value, sortable: true },
                    { key: 'budget_amount', header: 'Budget Amount', render: (value: number) => formatCurrency(value), sortable: true },
                ]}
                filterKeys={['project_id', 'cost_code_id']}
                onAdd={() => openCreate('budgets')}
                onEdit={(record) => setSectionForm('budgets', {
                    project_id: record.project_id,
                    cost_code_id: record.cost_code_id,
                    budget_amount: String(record.budget_amount),
                }, record.id)}
                onDelete={(record) => void handleDelete('budgets', record.id)}
            />

            {modalSection ? (
                <ERPFormModal
                    open
                    title={modalTitle}
                    loading={saving}
                    error={error}
                    values={form}
                    fields={fields[modalSection]}
                    submitLabel={modalMode === 'edit' ? 'Save Changes' : 'Create Record'}
                    onClose={closeModal}
                    onChange={handleFieldChange}
                    onSubmit={handleSubmit}
                />
            ) : null}
        </div>
    )
}
