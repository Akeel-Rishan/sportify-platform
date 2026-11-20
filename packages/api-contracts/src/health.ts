export interface HealthResponse {
  status: 'ok';
  service: 'sportify-api';
}

export interface ReadinessResponse {
  status: 'ready';
  scope: 'application';
}
