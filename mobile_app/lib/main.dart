import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';

const String serverUrl = "http://192.168.1.32:3000"; 

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeService();
  runApp(const GpsTrackerApp());
}

Future<void> initializeService() async {
  final service = FlutterBackgroundService();
  await service.configure(
    androidConfiguration: AndroidConfiguration(
      onStart: onStart,
      autoStart: false,
      isForegroundMode: true,
      notificationChannelId: 'my_foreground',
      initialNotificationTitle: 'Rastreamento GPS',
      initialNotificationContent: 'Aguardando inicialização...',
      foregroundServiceNotificationId: 888,
    ),
    iosConfiguration: IosConfiguration(
      autoStart: false,
      onForeground: onStart,
      onBackground: onIosBackground,
    ),
  );
}

@pragma('vm:entry-point')
Future<bool> onIosBackground(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  return true;
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();

  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });
    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }

  SharedPreferences prefs = await SharedPreferences.getInstance();
  String teamName = prefs.getString('teamName') ?? 'Equipe Desconhecida';
  String teamId = prefs.getString('teamId') ?? 'team_${DateTime.now().millisecondsSinceEpoch}';

  IO.Socket socket = IO.io(serverUrl, <String, dynamic>{
    'transports': ['websocket'],
    'autoConnect': true,
  });

  socket.onConnect((_) async {
    socket.emit('register_team', {
      'teamId': teamId,
      'name': teamName
    });
    
    try {
      Position initialPosition = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      socket.emit('update_location', {
        'lat': initialPosition.latitude,
        'lng': initialPosition.longitude,
        'status': "Online"
      });
    } catch(e) {}
  });

  const LocationSettings locationSettings = LocationSettings(
    accuracy: LocationAccuracy.high,
    distanceFilter: 10,
  );

  StreamSubscription<Position> positionStream = Geolocator.getPositionStream(locationSettings: locationSettings).listen((Position? position) {
    if (position != null) {
      socket.emit('update_location', {
        'lat': position.latitude,
        'lng': position.longitude,
        'status': "Online"
      });
      if (service is AndroidServiceInstance) {
         service.setForegroundNotificationInfo(
           title: "Rastreamento Ativo",
           content: "Enviando localização para o painel.",
         );
      }
    }
  });

  service.on('stopService').listen((event) {
    positionStream.cancel();
    socket.disconnect();
    service.stopSelf();
  });
}

class GpsTrackerApp extends StatelessWidget {
  const GpsTrackerApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GPS Técnico',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const TrackerScreen(),
    );
  }
}

class TrackerScreen extends StatefulWidget {
  const TrackerScreen({Key? key}) : super(key: key);

  @override
  State<TrackerScreen> createState() => _TrackerScreenState();
}

class _TrackerScreenState extends State<TrackerScreen> {
  final TextEditingController _teamController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isTracking = false;
  final String adminPassword = "123";

  @override
  void initState() {
    super.initState();
    _checkPermissions();
    _checkServiceStatus();
  }

  Future<void> _checkServiceStatus() async {
    final service = FlutterBackgroundService();
    bool isRunning = await service.isRunning();
    setState(() {
      _isTracking = isRunning;
    });
  }

  Future<void> _checkPermissions() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      await Geolocator.openAppSettings();
    }
  }

  void _startTracking() async {
    if (_teamController.text.isEmpty) return;

    SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString('teamName', _teamController.text);
    await prefs.setString('teamId', 'team_${DateTime.now().millisecondsSinceEpoch}');

    final service = FlutterBackgroundService();
    await service.startService();

    setState(() {
      _isTracking = true;
    });
  }

  void _showPasswordDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Desativar GPS'),
          content: TextField(
            controller: _passwordController,
            obscureText: true,
            decoration: const InputDecoration(hintText: "Senha administrativa"),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: () {
                if (_passwordController.text == adminPassword) {
                  _stopTracking();
                  Navigator.pop(context);
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Senha Incorreta!'))
                  );
                }
              },
              child: const Text('Confirmar', style: TextStyle(color: Colors.red)),
            ),
          ],
        );
      },
    );
  }

  void _stopTracking() async {
    final service = FlutterBackgroundService();
    service.invoke("stopService");
    setState(() {
      _isTracking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text('App do Técnico'),
        backgroundColor: const Color(0xFF4318FF),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Card(
            elevation: 4,
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: _isTracking ? _buildTrackingView() : _buildSetupView(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSetupView() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _teamController,
          decoration: const InputDecoration(
            labelText: 'Nome da Equipe',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF4318FF),
            minimumSize: const Size.fromHeight(50),
          ),
          onPressed: _startTracking,
          child: const Text('Iniciar App'),
        ),
      ],
    );
  }

  Widget _buildTrackingView() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.gps_fixed, color: Colors.green, size: 60),
        const SizedBox(height: 10),
        const Text(
          'Rastreamento em Andamento (Oculto)',
          style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red,
            minimumSize: const Size.fromHeight(50),
          ),
          onPressed: _showPasswordDialog,
          child: const Text('Parar App'),
        ),
      ],
    );
  }
}
