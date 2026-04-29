import 'dart:async';
import 'dart:isolate';
import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

const String kServerUrl = "https://mundonet-gps.49p1k1.easypanel.host";

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const GpsTrackerApp());
}

@pragma('vm:entry-point')
void startCallback() {
  FlutterForegroundTask.setTaskHandler(GpsTaskHandler());
}

class GpsTaskHandler extends TaskHandler {
  IO.Socket? _socket;
  StreamSubscription<Position>? _positionStream;
  final Battery _battery = Battery();
  final Connectivity _connectivity = Connectivity();

  @override
  void onStart(DateTime timestamp, SendPort? sendPort) async {
    final prefs = await SharedPreferences.getInstance();
    final String teamId = prefs.getString('deviceTeamId') ?? 'team_${DateTime.now().millisecondsSinceEpoch}';
    if (prefs.getString('deviceTeamId') == null) await prefs.setString('deviceTeamId', teamId);
    final String teamName = prefs.getString('currentTeamName') ?? "Técnico";

    _socket = IO.io(kServerUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
    });

    _socket?.onConnect((_) {
      _socket?.emit('register_team', {'teamId': teamId, 'name': teamName});
    });

    _positionStream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 0)
    ).listen((Position position) async {
      // Coletar telemetria
      int battLevel = await _battery.batteryLevel;
      var connResult = await _connectivity.checkConnectivity();
      String network = connResult.toString().split('.').last;

      if (_socket != null && _socket!.connected) {
        _socket!.emit('update_location', {
          'lat': position.latitude, 
          'lng': position.longitude, 
          'speed': position.speed * 3.6, // Converter para km/h
          'battery': battLevel,
          'network': network,
          'status': 'Online'
        });
      }
      
      FlutterForegroundTask.updateService(
        notificationTitle: 'Sincronização de Rede',
        notificationText: 'Status: Operacional | Link: Estável',
      );
    });
  }

  @override
  void onDestroy(DateTime timestamp, SendPort? sendPort) async {
    await _positionStream?.cancel();
    _socket?.disconnect();
  }
  
  @override
  void onRepeatEvent(DateTime timestamp, SendPort? sendPort) {}
}

class GpsTrackerApp extends StatelessWidget {
  const GpsTrackerApp({Key? key}) : super(key: key);
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Mundonet Tracker',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF001A3D),
        primaryColor: const Color(0xFF39B8FF),
        colorScheme: const ColorScheme.dark(primary: Color(0xFF39B8FF), secondary: Color(0xFF002D62)),
      ),
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
  final TextEditingController _controller = TextEditingController();
  bool _isRunning = false;

  @override
  void initState() {
    super.initState();
    _initForegroundTask();
    _checkStatus();
  }

  void _initForegroundTask() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'system_sync_v1',
        channelName: 'System Services',
        channelImportance: NotificationChannelImportance.MIN, // Menor importância possível
        priority: NotificationPriority.LOW,
        isSticky: true,
        iconData: const NotificationIconData(
          resType: ResourceType.mipmap,
          resPrefix: ResourcePrefix.ic,
          name: 'launcher',
        ),
      ),
      iosNotificationOptions: const IOSNotificationOptions(showNotification: true),
      foregroundTaskOptions: const ForegroundTaskOptions(
        interval: 2000, // Enviar a cada 2 segundos
        allowWakeLock: true,
      ),
    );
  }

  Future<void> _checkStatus() async {
    final running = await FlutterForegroundTask.isRunningService;
    setState(() => _isRunning = running);
  }

  Future<void> _start() async {
    if (_controller.text.isEmpty) return;
    await Permission.notification.request();
    await Permission.location.request();
    await Permission.locationAlways.request();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('currentTeamName', _controller.text);
    await FlutterForegroundTask.startService(
      notificationTitle: 'Sincronização de Sistema',
      notificationText: 'Serviços de rede operando em segundo plano',
      callback: startCallback,
    );
    await WakelockPlus.enable();
    _checkStatus();
  }

  Future<void> _stop() async {
    // Solicitar senha para parar
    final TextEditingController pinController = TextEditingController();
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar Identidade'),
        content: TextField(
          controller: pinController,
          obscureText: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(hintText: 'Digite o PIN de administrador'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('CANCELAR')),
          TextButton(onPressed: () => Navigator.pop(context, pinController.text == '9910'), child: const Text('CONFIRMAR')),
        ],
      ),
    );

    if (confirm == true) {
      await FlutterForegroundTask.stopService();
      await WakelockPlus.disable();
      _checkStatus();
    } else if (confirm == false) {
      if (!mounted) return;
       ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('PIN incorreto ou operação cancelada')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Color(0xFF002D62), Color(0xFF000C1D)],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 30),
            child: Column(
              children: [
                const SizedBox(height: 60),
                Image.asset('assets/logo.png', width: 250),
                const SizedBox(height: 10),
                const Text('SERVICE MANAGER v2.4', style: TextStyle(letterSpacing: 2, fontSize: 12, color: Colors.white70)),
                const SizedBox(height: 80),
                
                Container(
                  padding: const EdgeInsets.all(25),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Column(
                    children: [
                      Icon(_isRunning ? Icons.radar : Icons.location_off_rounded, 
                           color: _isRunning ? const Color(0xFF34D399) : Colors.redAccent, size: 60),
                      const SizedBox(height: 20),
                      if (!_isRunning) ...[
                        TextField(
                          controller: _controller,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 18),
                          decoration: InputDecoration(
                            hintText: 'Nome da Equipe',
                            filled: true,
                            fillColor: Colors.black26,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          ),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity, height: 55,
                          child: ElevatedButton(
                            onPressed: _start,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF39B8FF),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('INICIAR MONITORAMENTO', style: TextStyle(color: Color(0xFF002D62), fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ] else ...[
                        const Text('SYNC ATIVO', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        const SizedBox(height: 5),
                        const Text('Serviços de rede operando em segundo plano', style: TextStyle(color: Colors.white54, fontSize: 12)),
                        const SizedBox(height: 30),
                        SizedBox(
                          width: double.infinity, height: 55,
                          child: ElevatedButton(
                            onPressed: _stop,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.redAccent.withOpacity(0.2),
                              side: const BorderSide(color: Colors.redAccent),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('PARAR SERVIÇO', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 40),
                const Text('v2.0 - Mundonet Tracker', style: TextStyle(color: Colors.white24, fontSize: 10)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
