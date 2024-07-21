import React, { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
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
  CircularProgress,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import MetricsDisplay from './MetricsDisplay';
import ReconnectingWebSocket from 'reconnecting-websocket';

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
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ws;

    const connectWebSocket = () => {
      setIsConnecting(true);
      setError(null);

      const options = {
        WebSocket: WebSocket,
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1500,
        reconnectionDelayGrowFactor: 1.3,
        maxRetries: 5,
      };

      ws = new ReconnectingWebSocket('ws://localhost:8080', [], options);

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const newData = JSON.parse(event.data);
          console.log('Received data:', newData);
          setData(newData);
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
          setError('Error processing data from server');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Failed to connect to the server. Please try again later.');
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed');
        if (!event.wasClean) {
          setIsConnecting(true);
          console.log('WebSocket connection lost. Attempting to reconnect...');
        } else {
          setIsConnecting(false);
          console.log('WebSocket connection closed cleanly');
        }
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        console.log('Closing WebSocket connection');
        ws.close();
      }
    };
  }, []);

  const serverHealthData = {
    labels: data.servers?.map(server => server.domain) || [],
    datasets: [{
      label: 'Server Health Scores',
      data: data.servers?.map(server => server.healthScore) || [],
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1,
    }]
  };

  const serverLatencyData = {
    labels: data.servers?.map(server => server.domain) || [],
    datasets: [{
      label: 'Server Latency (ms)',
      data: data.servers?.map(server => server.latency) || [],
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1,
    }]
  };

  const requestsPerSecondData = {
    labels: data.servers?.map(server => server.domain) || [],
    datasets: [{
      label: 'Requests per Second',
      data: data.servers?.map(server => 
        data.metrics?.[`requests_per_second{server="${server.domain}"}`] || 0
      ) || [],
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
    }]
  };

  const renderContent = () => {
    if (isConnecting) {
      return (
        <Grid container justifyContent="center" style={{ marginTop: '2rem' }}>
          <CircularProgress />
          <Typography variant="h6" style={{ marginLeft: '1rem' }}>
            Connecting to server...
          </Typography>
        </Grid>
      );
    }

    if (error) {
      return (
        <Typography color="error" variant="h6" style={{ marginTop: '2rem' }}>
          {error}
        </Typography>
      );
    }

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Server Health</Typography>
              {serverHealthData.labels.length > 0 ? (
                <Bar data={serverHealthData} options={{
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                    }
                  }
                }} />
              ) : (
                <Typography>No server health data available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Server Latency</Typography>
              {serverLatencyData.labels.length > 0 ? (
                <Bar data={serverLatencyData} options={{
                  scales: {
                    y: {
                      beginAtZero: true,
                    }
                  }
                }} />
              ) : (
                <Typography>No server latency data available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6">Requests per Second</Typography>
              {requestsPerSecondData.labels.length > 0 ? (
                <Line data={requestsPerSecondData} options={{
                  scales: {
                    y: {
                      beginAtZero: true,
                    }
                  }
                }} />
              ) : (
                <Typography>No requests per second data available</Typography>
              )}
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
    );
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
          {renderContent()}
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;