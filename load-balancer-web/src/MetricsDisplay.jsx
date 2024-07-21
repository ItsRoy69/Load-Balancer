import React from 'react';
import { Typography, Grid, Paper, Card, CardContent } from '@mui/material';

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatMetricName(name) {
  if (name.includes('nodejs_gc_duration_seconds_bucket')) {
    const [, le, kind] = name.match(/le="([^"]+)",kind="([^"]+)"/);
    return `${kind.charAt(0).toUpperCase() + kind.slice(1)} GC duration ≤ ${le}s`;
  }
  return name.replace(/_/g, ' ').replace(/\{[^}]+\}/g, '').trim();
}

function formatMetricValue(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : value.toFixed(6);
  }
  return value;
}

function MetricItem({ name, value }) {
  return (
    <Paper elevation={2} style={{ padding: '0.5rem', height: '100%' }}>
      <Typography variant="caption" color="textSecondary" noWrap>
        {formatMetricName(name)}
      </Typography>
      <Typography variant="body2">
        {value !== undefined ? formatMetricValue(value) : 'N/A'}
      </Typography>
    </Paper>
  );
}

function HeapMetrics({ metrics }) {
  const heapOverview = [
    { label: 'Total Size', value: metrics['nodejs_heap_size_total_bytes'] },
    { label: 'Used Size', value: metrics['nodejs_heap_size_used_bytes'] },
  ];

  const heapSpaces = [
    'read_only', 'new', 'old', 'code', 'shared', 'new_large_object', 'large_object', 'code_large_object', 'shared_large_object'
  ];

  return (
    <Card style={{ marginBottom: '1rem' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Heap Memory</Typography>
        <Grid container spacing={2}>
          {heapOverview.map(({ label, value }) => (
            <Grid item xs={6} key={label}>
              <Paper elevation={2} style={{ padding: '0.5rem', height: '100%' }}>
                <Typography variant="caption" color="textSecondary">{label}</Typography>
                <Typography variant="body2">{formatBytes(value)}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Typography variant="subtitle1" style={{ marginTop: '1rem' }}>Heap Spaces</Typography>
        <Grid container spacing={2}>
          {heapSpaces.map(space => (
            <Grid item xs={12} sm={6} md={4} key={space}>
              <Paper elevation={2} style={{ padding: '0.5rem', height: '100%' }}>
                <Typography variant="caption" color="textSecondary">{space.replace(/_/g, ' ')}</Typography>
                <Typography variant="body2">
                  Total: {formatBytes(metrics[`nodejs_heap_space_size_total_bytes{space="${space}"}`])}<br/>
                  Used: {formatBytes(metrics[`nodejs_heap_space_size_used_bytes{space="${space}"}`])}<br/>
                  Available: {formatBytes(metrics[`nodejs_heap_space_size_available_bytes{space="${space}"}`])}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

function MetricGroup({ title, metrics }) {
  return (
    <Card style={{ marginBottom: '1rem' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Grid container spacing={2}>
          {Object.entries(metrics).map(([key, value]) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={key}>
              <MetricItem name={key} value={value} />
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

function MetricsDisplay({ metrics }) {
  const groupMetrics = (metrics) => {
    const groups = {
      'CPU': {},
      'Memory': {},
      'Event Loop': {},
      'Resources': {},
      'GC': {},
      'Other': {}
    };

    Object.entries(metrics).forEach(([key, value]) => {
      if (key.startsWith('process_cpu')) groups['CPU'][key] = value;
      else if (key.includes('memory') && !key.includes('heap')) groups['Memory'][key] = value;
      else if (key.includes('eventloop')) groups['Event Loop'][key] = value;
      else if (key.includes('active_resources') || key.includes('active_handles')) groups['Resources'][key] = value;
      else if (key.includes('gc_duration')) groups['GC'][key] = value;
      else if (!key.startsWith('nodejs_heap_')) groups['Other'][key] = value;
    });

    return groups;
  };

  const groupedMetrics = groupMetrics(metrics);

  return (
    <>
      <Typography variant="h5" gutterBottom>Metrics</Typography>
      <HeapMetrics metrics={metrics} />
      {Object.entries(groupedMetrics).map(([groupName, groupMetrics]) => (
        <MetricGroup key={groupName} title={groupName} metrics={groupMetrics} />
      ))}
    </>
  );
}

export default MetricsDisplay;