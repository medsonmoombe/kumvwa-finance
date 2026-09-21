class Env {
  Env._();

  static const appEnv = String.fromEnvironment('APP_ENV', defaultValue: 'dev');

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8080/api/v1', // Android emulator → localhost
  );

  static bool get isDev => appEnv == 'dev';
}
