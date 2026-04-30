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

void main() async {
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
  SendPort? _sendPort;

  void _sendLog(String msg) {
    print('LOG: $msg');
    _sendPort?.send({'log': msg});
  }

  @override
  void onStart(DateTime timestamp, SendPort? sendPort) async {
    _sendPort = sendPort;
    _sendLog('1. Isolate iniciado');
    
    try {
      final customData = await FlutterForegroundTask.getData<Map<String, dynamic>>(key: 'trackingData');
      _sendLog('2. Dados carregados: ${customData?['teamName']}');

      final String teamId = customData?['teamId'] ?? 'device_${DateTime.now().millisecondsSinceEpoch}';
      final String teamName = customData?['teamName'] ?? "Técnico";

      _sendLog('3. Conectando: $kServerUrl');
      _socket = IO.io(kServerUrl, <String, dynamic>{
        'transports': ['websocket', 'polling'],
        'autoConnect': true,
        'forceNew': true,
        'reconnection': true,
        'reconnectionDelay': 1000,
        'reconnectionAttempts': 500,
      });

      _socket?.onConnect((_) {
        _sendLog('4. Socket: CONECTADO ✅');
        _socket?.emit('register_team', {'teamId': teamId, 'name': teamName});
      });

      _socket?.onConnectError((err) => _sendLog('Erro Socket: $err'));
      _socket?.onConnectTimeout((_) => _sendLog('Timeout Socket ⏳'));

      _sendLog('5. Ativando GPS...');
      
      // Verificar permissão antes de ouvir
      LocationPermission permission = await Geolocator.checkPermission();
      _sendLog('6. Permissão GPS: $permission');

      _positionStream = Geolocator.getPositionStream(
        locationSettings: AndroidSettings(
          accuracy: LocationAccuracy.best,
          distanceFilter: 0,
          intervalDuration: const Duration(seconds: 5),
        )
      ).listen((Position position) async {
        _sendLog('7. GPS: Localização OK 📍');
        
        int battLevel = await _battery.batteryLevel;
        var connResult = await _connectivity.checkConnectivity();
        String network = connResult.toString().split('.').last;

        if (_socket != null && _socket!.connected) {
          _socket!.emit('update_location', {
            'lat': position.latitude, 
            'lng': position.longitude, 
            'speed': position.speed * 3.6,
            'heading': position.heading,
            'battery': battLevel,
            'network': network,
            'status': 'Online'
          });
          _sendLog('8. Dados: ENVIADOS 🚀');
        } else {
          _sendLog('Aguardando Socket... ⏳');
        }
        
        FlutterForegroundTask.updateService(
          notificationTitle: 'Mundonet Tracker • OK',
          notificationText: 'Sincronizado às ${DateTime.now().hour}:${DateTime.now().minute}:${DateTime.now().second}',
        );
      }, onError: (err) => _sendLog('ERRO GPS: $err ❌'));
      
    } catch (e) {
      _sendLog('ERRO FATAL: $e');
    }
  }

  @override
  void onDestroy(DateTime timestamp, SendPort? sendPort) async {
    _sendLog('Serviço finalizado');
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
        scaffoldBackgroundColor: const Color(0xFF0B0E14),
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
  final List<String> _logs = [];
  ReceivePort? _receivePort;

  @override
  void initState() {
    super.initState();
    _loadStoredName();
    _initForegroundTask();
    _checkStatus();
  }

  @override
  void dispose() {
    _closeReceivePort();
    super.dispose();
  }

  void _closeReceivePort() {
    _receivePort?.close();
    _receivePort = null;
  }

  Future<void> _loadStoredName() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _controller.text = prefs.getString('currentTeamName') ?? "";
    });
  }

  void _initForegroundTask() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'mundonet_tracker_v1',
        channelName: 'Mundonet Tracking Service',
        channelImportance: NotificationChannelImportance.HIGH, 
        priority: NotificationPriority.HIGH,
        isSticky: true,
        visibility: NotificationVisibility.VISIBILITY_PUBLIC,
        iconData: const NotificationIconData(
          resType: ResourceType.mipmap,
          resPrefix: ResourcePrefix.ic,
          name: 'launcher',
        ),
      ),
      iosNotificationOptions: const IOSNotificationOptions(showNotification: true),
      foregroundTaskOptions: const ForegroundTaskOptions(
        interval: 5000, 
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );
  }

  Future<void> _checkStatus() async {
    final running = await FlutterForegroundTask.isRunningService;
    if (running) {
      _registerReceivePort(await FlutterForegroundTask.receivePort);
    }
    if (!await FlutterForegroundTask.isIgnoringBatteryOptimizations) {
      await FlutterForegroundTask.requestIgnoreBatteryOptimization();
    }
    setState(() => _isRunning = running);
  }

  void _registerReceivePort(ReceivePort? newReceivePort) {
    if (newReceivePort == null) return;
    _closeReceivePort();
    _receivePort = newReceivePort;
    _receivePort?.listen((data) {
      if (data is Map && data.containsKey('log')) {
        setState(() {
          _logs.add(data['log']);
          if (_logs.length > 20) _logs.removeAt(0);
        });
      }
    });
  }

  Future<void> _start() async {
    if (_controller.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Identifique o técnico')));
      return;
    }
    
    await Permission.notification.request();
    var status = await Permission.location.request();
    if (status.isDenied) return;

    var backgroundStatus = await Permission.locationAlways.request();
    if (backgroundStatus.isDenied) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ative "Permitir o tempo todo"')));
      await openAppSettings();
      return;
    }
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('currentTeamName', _controller.text);
    String? teamId = prefs.getString('deviceTeamId') ?? 'team_${DateTime.now().millisecondsSinceEpoch}';
    if (prefs.getString('deviceTeamId') == null) await prefs.setString('deviceTeamId', teamId);
    
    await FlutterForegroundTask.saveData(key: 'trackingData', value: {'teamId': teamId, 'teamName': _controller.text});

    final bool result = await FlutterForegroundTask.startService(
      notificationTitle: 'Mundonet Tracker',
      notificationText: 'Iniciando...',
      callback: startCallback,
    );

    if (result) {
      _registerReceivePort(await FlutterForegroundTask.receivePort);
    }
    
    await WakelockPlus.enable();
    _checkStatus();
  }

  Future<void> _stop() async {
    final TextEditingController pinController = TextEditingController();
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1F26),
        title: const Text('Confirmar Interrupção'),
        content: TextField(controller: pinController, obscureText: true, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'PIN administrador')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('CANCELAR')),
          TextButton(onPressed: () => Navigator.pop(context, pinController.text == '9910'), child: const Text('OK')),
        ],
      ),
    );

    if (confirm == true) {
      await FlutterForegroundTask.stopService();
      await WakelockPlus.disable();
      _closeReceivePort();
      _checkStatus();
      setState(() => _logs.clear());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: WithForegroundTask(
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF002D62), Color(0xFF0B0E14)]),
          ),
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 30),
              child: Column(
                children: [
                  const SizedBox(height: 50),
                  Image.network('https://mundonetbandalarga.com.br/wp-content/uploads/2021/04/logo-mundonet.png', height: 50, errorBuilder: (c, e, s) => const Icon(Icons.location_on, size: 50, color: Color(0xFF39B8FF))),
                  const SizedBox(height: 40),
                  _buildMainCard(),
                  const SizedBox(height: 20),
                  _buildDiagnosticsCard(),
                  const SizedBox(height: 20),
                  _buildLogCard(),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMainCard() {
    return Container(
      padding: const EdgeInsets.all(25),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.03), borderRadius: BorderRadius.circular(24), border: Border.all(color: Colors.white10)),
      child: Column(
        children: [
          _buildStatusIndicator(),
          const SizedBox(height: 20),
          if (!_isRunning) ...[
            TextField(controller: _controller, textAlign: TextAlign.center, decoration: InputDecoration(hintText: 'Nome do Técnico', filled: true, fillColor: Colors.black26, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none))),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, height: 55, child: ElevatedButton(onPressed: _start, style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF39B8FF), foregroundColor: Colors.black), child: const Text('ATIVAR RASTREAMENTO', style: TextStyle(fontWeight: FontWeight.bold)))),
          ] else ...[
            Text(_controller.text.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const Text('SISTEMA OPERACIONAL', style: TextStyle(color: Color(0xFF34D399), fontSize: 11)),
            const SizedBox(height: 30),
            OutlinedButton(onPressed: _stop, style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white10)), child: const Text('PARAR SERVIÇO', style: TextStyle(color: Colors.white30))),
          ],
        ],
      ),
    );
  }

  Widget _buildLogCard() {
    return Container(
      width: double.infinity, height: 150, padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: Colors.black38, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('LOG DE EVENTOS', style: TextStyle(fontSize: 9, color: Colors.white30, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Expanded(
            child: ListView.builder(
              reverse: true,
              itemCount: _logs.length,
              itemBuilder: (context, index) => Text(_logs[_logs.length - 1 - index], style: const TextStyle(fontSize: 10, color: Colors.white70, fontFamily: 'monospace')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusIndicator() {
    return Container(
      width: 80, height: 80,
      decoration: BoxDecoration(shape: BoxShape.circle, color: _isRunning ? const Color(0xFF34D399).withOpacity(0.1) : Colors.white10, border: Border.all(color: _isRunning ? const Color(0xFF34D399) : Colors.white10)),
      child: Icon(_isRunning ? Icons.radar : Icons.power_settings_new, color: _isRunning ? const Color(0xFF34D399) : Colors.white24, size: 40),
    );
  }

  Widget _buildDiagnosticsCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.02), borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white10)),
      child: Column(
        children: [
          _buildDiagRow('Sinal Satélite', _isRunning ? 'OK' : '--', Icons.satellite_alt),
          _buildDiagRow('Frequência', '5 seg', Icons.timer_outlined),
          _buildDiagRow('Servidor', 'Mundonet', Icons.cloud_queue),
        ],
      ),
    );
  }

  Widget _buildDiagRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(children: [Icon(icon, size: 14, color: Colors.white24), const SizedBox(width: 8), Text(label, style: const TextStyle(fontSize: 12, color: Colors.white70))]),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF39B8FF))),
        ],
      ),
    );
  }
}
