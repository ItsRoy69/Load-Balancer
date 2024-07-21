import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Grid, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Card,
  CardContent,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import MetricsDisplay from './MetricsDisplay';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [data, setData] = useState({
    servers: [],
    metrics: {}
  });

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:80');

    ws.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      setData(newData);
    };

    return () => ws.close();
  }, []);

  const serverHealthData = {
    labels: data.servers.map(server => server.domain),
    datasets: [{
      label: 'Server Health Scores',
      data: data.servers.map(server => server.healthScore),
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1,
    }]
  };

  const serverLatencyData = {
    labels: data.servers.map(server => server.domain),
    datasets: [{
      label: 'Server Latency (ms)',
      data: data.servers.map(server => server.latency),
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1,
    }]
  };

  const requestsPerSecondData = {
    labels: data.servers.map(server => server.domain),
    datasets: [{
      label: 'Requests per Second',
      data: data.servers.map(server => 
        data.metrics[`http_request_duration_ms_count{server="${server.domain}"}`] || 0
      ),
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
    }]
  };

  return (
    <ThemeProvider theme={theme}>
      <div className="App">
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6">Load Balancer Dashboard</Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="lg" style={{ marginTop: '2rem' }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Server Health</Typography>
                  <Bar data={serverHealthData} options={{
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                      }
                    }
                  }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Server Latency</Typography>
                  <Bar data={serverLatencyData} options={{
                    scales: {
                      y: {
                        beginAtZero: true,
                      }
                    }
                  }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Requests per Second</Typography>
                  <Bar data={requestsPerSecondData} options={{
                    scales: {
                      y: {
                        beginAtZero: true,
                      }
                    }
                  }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6">Servers</Typography>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Domain</TableCell>
                          <TableCell>Region</TableCell>
                          <TableCell>Health</TableCell>
                          <TableCell>Health Score</TableCell>
                          <TableCell>Latency</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.servers.map(server => (
                          <TableRow key={server.domain}>
                            <TableCell>{server.domain}</TableCell>
                            <TableCell>{server.region}</TableCell>
                            <TableCell>{server.isHealthy ? 'Healthy' : 'Unhealthy'}</TableCell>
                            <TableCell>{server.healthScore}</TableCell>
                            <TableCell>{server.latency}ms</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <MetricsDisplay metrics={data.metrics} />
            </Grid>
          </Grid>
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;