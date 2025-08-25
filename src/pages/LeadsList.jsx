import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Button, Box, Typography, TextField, 
  MenuItem, Select, FormControl, 
  InputLabel, Pagination, Paper, IconButton, CircularProgress
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../config/axios';

const LeadsList = () => {
  // State for grid data and loading
  const [rowData, setRowData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gridApi, setGridApi] = useState(null);
  
  // Router and auth hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });

  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    source: '',
    startDate: null,
    endDate: null,
    minScore: '',
    maxScore: '',
    minValue: '',
    maxValue: ''
  });
  
  // Memoized row data to prevent unnecessary re-renders
  const safeRowData = useMemo(() => Array.isArray(rowData) ? rowData : [], [rowData]);
  
  // Status and source options for filters (must match backend enums)
  const statusOptions = useMemo(
    () => [
      { label: 'New', value: 'new' },
      { label: 'Contacted', value: 'contacted' },
      { label: 'Qualified', value: 'qualified' },
      { label: 'Lost', value: 'lost' },
      { label: 'Won', value: 'won' },
    ],
    []
  );
  const sourceOptions = useMemo(
    () => [
      { label: 'Website', value: 'website' },
      { label: 'Facebook Ads', value: 'facebook_ads' },
      { label: 'Google Ads', value: 'google_ads' },
      { label: 'Referral', value: 'referral' },
      { label: 'Events', value: 'events' },
      { label: 'Other', value: 'other' },
    ],
    []
  );
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/leads' } });
    }
  }, [isAuthenticated, navigate]);

  const handleDelete = async (params) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        await api.delete(`/leads/${params.data._id}`);
        // Refresh the leads list after deletion
        fetchLeads();
      } catch (error) {
        console.error('Error deleting lead:', error);
        const errorMessage = error.response 
          ? `Error: ${error.response.data?.message || 'Failed to delete lead'}`
          : 'Network error - Unable to connect to the server';
        setError(errorMessage);
      }
    }
  };

  // AbortController to cancel in-flight requests
  const controllerRef = useRef(null);
  // Flag to skip first debounce run (prevents double fetch on mount)
  const didInitRef = useRef(false);

  const fetchLeads = useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { page, limit } = pagination;
      const params = new URLSearchParams();
      
      // Always add pagination
      params.append('page', page);
      params.append('limit', limit);
      
      // Add filters if they exist
      if (filters.search) params.append('search', filters.search.trim());
      if (filters.status) params.append('status', filters.status.toLowerCase().replace(/\s+/g, '_'));
      if (filters.source) params.append('source', filters.source.toLowerCase().replace(/\s+/g, '_'));

      // Numeric filters (score, lead_value) - combine to single object per key
      const scoreFilter = {};
      if (filters.minScore) scoreFilter.gt = Number(filters.minScore);
      if (filters.maxScore) scoreFilter.lt = Number(filters.maxScore);
      if (Object.keys(scoreFilter).length) params.append('score', JSON.stringify(scoreFilter));

      const valueFilter = {};
      if (filters.minValue) valueFilter.gt = Number(filters.minValue);
      if (filters.maxValue) valueFilter.lt = Number(filters.maxValue);
      if (Object.keys(valueFilter).length) params.append('lead_value', JSON.stringify(valueFilter));

      // Date filter (created_at) - combine before/after
      const createdAtFilter = {};
      if (filters.startDate) createdAtFilter.after = filters.startDate.toISOString();
      if (filters.endDate) createdAtFilter.before = filters.endDate.toISOString();
      if (Object.keys(createdAtFilter).length) params.append('created_at', JSON.stringify(createdAtFilter));

      // cancel any previous request
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      controllerRef.current = new AbortController();

      const response = await api.get(`/leads?${params}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        signal: controllerRef.current.signal,
      });
      
      // Handle the response data
      const responseData = response.data;
      const leadsData = responseData?.data || [];
      
      setRowData(leadsData);
      
      // Update pagination with server response
      setPagination(prev => ({
        ...prev,
        total: responseData.total || 0,
        totalPages: responseData.totalPages || 1
      }));
      
      setError(null);
      return leadsData;
    } catch (error) {
      // Ignore aborted requests to avoid flicker
      if (error?.name === 'CanceledError' || error?.name === 'AbortError') {
        return;
      }
      console.error('Error fetching leads:', error);
      const errorMessage = error.response?.data?.message || 'Failed to fetch leads. Please try again.';
      setError(errorMessage);
      
      // If unauthorized, redirect to login
      if (error.response?.status === 401) {
        navigate('/login', { state: { from: '/leads' } });
      }
      
      // Reset data on error
      setRowData([]);
      setPagination(prev => ({
        ...prev,
        total: 0,
        totalPages: 1
      }));
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [
    isAuthenticated,
    navigate,
    pagination.page,
    pagination.limit,
    filters.search,
    filters.status,
    filters.source,
    filters.minScore,
    filters.maxScore,
    filters.minValue,
    filters.maxValue,
    filters.startDate,
    filters.endDate
  ]);

  // Keep a stable reference to the latest fetchLeads
  const fetchLeadsRef = useRef(fetchLeads);
  useEffect(() => {
    fetchLeadsRef.current = fetchLeads;
  }, [fetchLeads]);

  // Debounce filter changes to prevent too many API calls
  useEffect(() => {
    // Skip first run to avoid duplicate initial fetch
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    const search = (filters.search || '').trim();
    // Trigger fetch when search is cleared or has at least 1 char
    if (search.length === 0 || search.length >= 1) {
      const handler = setTimeout(() => {
        if (pagination.page !== 1) {
          setPagination(p => ({ ...p, page: 1 }));
        } else {
          fetchLeadsRef.current();
        }
      }, 450);
      return () => clearTimeout(handler);
    }
  }, [
    filters.search,
    filters.status,
    filters.source,
    filters.startDate,
    filters.endDate,
    filters.minScore,
    filters.maxScore,
    filters.minValue,
    filters.maxValue,
    pagination.page
  ]);

  // Fetch when page changes (or on mount via initial page=1)
  useEffect(() => {
    fetchLeadsRef.current();
  }, [pagination.page]);

  // One-time refetch after create/edit navigates back with { state: { refresh: true } }
  useEffect(() => {
    if (location.state && location.state.refresh) {
      // Refetch leads and clear the refresh flag from history state
      fetchLeadsRef.current();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Abort in-flight request on unmount
  useEffect(() => () => {
    if (controllerRef.current) controllerRef.current.abort();
  }, []);

  // Handle grid ready event
  const onGridReady = useCallback((params) => {
    setGridApi(params.api);
    // Set initial size and auto-size columns
    params.api.sizeColumnsToFit();
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (gridApi) {
        gridApi.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridApi]);

  // Helper to format a date/time value to 24-hour format
  const formatDateTime24 = useCallback((value) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (isNaN(d)) return 'N/A';
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, []);

  // Default column definition for AG Grid
  const defaultColDef = {
    sortable: true,
    resizable: true,
    filter: false, // Disable client-side filtering as we're doing it server-side
    floatingFilter: false,
    wrapText: true,
    autoHeight: true,
    minWidth: 120,
    flex: 1,
    cellStyle: { 
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'normal',
      lineHeight: 'normal',
      padding: '8px 16px'
    },
    headerClass: 'header-cell',
  };
  

  const columnDefs = [
    { 
      field: 'first_name', 
      headerName: 'First Name',
      minWidth: 110
    },
    { 
      field: 'last_name', 
      headerName: 'Last Name',
      minWidth: 110
    },
    { 
      field: 'email', 
      headerName: 'Email',
      minWidth: 180,
      flex: 1.5
    },
    { 
      field: 'phone', 
      headerName: 'Phone',
      minWidth: 160
    },
    { 
      field: 'company', 
      headerName: 'Company',
      minWidth: 180
    },
    { 
      field: 'status', 
      headerName: 'Status',
      minWidth: 110,
      valueFormatter: (params) => params.value || 'N/A',
      cellStyle: (params) => ({
        ...defaultColDef.cellStyle,
        textTransform: 'capitalize'
      })
    },
    { 
      field: 'source', 
      headerName: 'Source',
      minWidth: 120,
      valueFormatter: (params) => params.value || 'N/A',
      cellStyle: {
        ...defaultColDef.cellStyle,
        textTransform: 'capitalize'
      }
    },
    {
      field: 'score',
      headerName: 'Score',
      minWidth: 100,
      valueFormatter: (params) => params.value || 'N/A',
      cellStyle: {
        ...defaultColDef.cellStyle,
        justifyContent: 'center'
      }
    },
    {
      field: 'lead_value',
      headerName: 'Lead Value',
      minWidth: 120,
      flex:1,
      valueFormatter: (params) => params.value || 'N/A'
    },
    {
      field: 'last_activity_at',
      headerName: 'Last Activity At',
      minWidth: 140,
      flex:1,
      valueFormatter: (params) => params.value || 'N/A'
    },
    {
      field: 'is_qualified',
      headerName: 'is_qualified',
      minWidth: 120,
      flex:1,
      valueFormatter: (params) => params.value || 'N/A'
    },
    {
      field: 'createdAt',
      headerName: 'Created At',
      minWidth: 140,
      flex:1,
      valueFormatter: (params) => formatDateTime24(params.value)
    },
    {
      field: 'updatedAt',
      headerName: 'Updated At',
      minWidth: 140,
      flex:1,
      valueFormatter: (params) => formatDateTime24(params.value)
    },
    {
      field: 'actions',
      headerName: 'Actions',
      minWidth: 180,
      maxWidth: 220,
      sortable: false,
      filter: false,
      resizable: false,
      suppressNavigable: true,
      cellStyle: {
        ...defaultColDef.cellStyle,
        justifyContent: 'center',
        padding: '4px 16px'
      },
      cellRenderer: (params) => (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <Button
            variant="contained"
            size="small"
            color="primary"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/leads/${params.data._id}/edit`);
            }}
            sx={{ mr: 1 }}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            size="small"
            color="error"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDelete(params);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // Don't show anything during initial load to prevent flashing
  if (isLoading && rowData.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
        <Typography color="error" variant="h6" gutterBottom>
          {error}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={fetchLeads}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: 'calc(100vh - 100px)',
        width: '100%',
        maxWidth: '100%',
        p: 2,
        boxSizing: 'border-box',
        overflowX: 'hidden',
        '& .ag-root-wrapper': {
          border: 'none',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        },
        '& .ag-header': {
          backgroundColor: '#f5f5f5',
          borderBottom: '2px solid #e0e0e0',
        },
        '& .ag-header-cell': {
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          fontWeight: '600',
          color: '#333',
        },
        '& .ag-row': {
          borderBottom: '1px solid #f0f0f0',
        },
        '& .ag-row:hover': {
          backgroundColor: '#f9f9f9',
        },
        '& .ag-cell': {
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
        },
        '& .ag-paging-panel': {
          borderTop: '1px solid #e0e0e0',
          padding: '12px 16px',
        },
      }}>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h4">All Leads</Typography>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => navigate('/leads/new')}
            >
              Add New Lead
            </Button>
          </Box>
          
          {/* Search and Filters */}
          <Paper sx={{ p: 1.5, mb: 1 }}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search Input */}
              <TextField
                label="Search"
                variant="outlined"
                size="small"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
                  endAdornment: filters.search && (
                    <IconButton size="small" onClick={() => setFilters(prev => ({ ...prev, search: '' }))}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )
                }}
                sx={{ minWidth: 250 }}
              />
              
              {/* Status Filter */}
              <FormControl variant="outlined" size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {statusOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {/* Source Filter */}
              <FormControl variant="outlined" size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Source</InputLabel>
                <Select
                  value={filters.source}
                  onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
                  label="Source"
                >
                  <MenuItem value="">All Sources</MenuItem>
                  {sourceOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Button 
                variant="outlined" 
                color="primary"
                onClick={() => setFilters({ search: '', status: '', source: '' })}
                disabled={!filters.search && !filters.status && !filters.source}
              >
                Clear Filters
              </Button>
            </Box>
          </Paper>
    </Box>
    
    {/* Main Content */}
    {isLoading ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Typography>Loading leads...</Typography>
      </Box>
    ) : error ? (
      <Box sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText', borderRadius: 1, mb: 2 }}>
        <Typography>{error}</Typography>
      </Box>
    ) : rowData.length === 0 ? (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '300px',
          bgcolor: '#fafafa',
          borderRadius: '8px',
          border: '1px dashed #e0e0e0'
        }}
      >
        <Typography variant="h6" color="textSecondary" gutterBottom>
          No leads found
        </Typography>
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={fetchLeads}
          disabled={isLoading}
          sx={{ mt: 1 }}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </Box>
    ) : (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="ag-theme-alpine" style={{ flex: 1, width: '100%', minHeight: 0 }}>
          <AgGridReact
            rowData={safeRowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            suppressPaginationPanel={true}
            suppressRowClickSelection={true}
            suppressCellFocus={true}
            onGridReady={onGridReady}
            onFirstDataRendered={(params) => params.api.sizeColumnsToFit()}
            onViewportChanged={(params) => params.api.sizeColumnsToFit()}
            onModelUpdated={(params) => params.api.sizeColumnsToFit()}
            onColumnResized={(params) => {
              if (params.source !== 'sizeColumnsToFit') {
                params.api.sizeColumnsToFit();
              }
            }}
            onGridSizeChanged={(params) => {
              params.api.sizeColumnsToFit();
            }}
            overlayNoRowsTemplate='<span style="padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; background: #f9f9f9; color: #666;">No data to display</span>'
          />
        </div>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.page}
            onChange={(event, value) => setPagination(prev => ({ ...prev, page: value }))}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
        {/* Footer counts below the grid */}
        <Box sx={{ mt: 1, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">
            Total leads: {pagination.total} • Leads on this page: {safeRowData.length} • Per page: {pagination.limit} • Page {pagination.page} of {pagination.totalPages}
          </Typography>
        </Box>
      </Box>
    )}
  </Box>
</LocalizationProvider>
  );
};

export default LeadsList;
