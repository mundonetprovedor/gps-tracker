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

  @override
  void onStart(DateTime timestamp, SendPort? sendPort) async {
    // Pegar dados passados pelo processo principal
    final customData = await FlutterForegroundTask.getData<Map<String, dynamic>>(key: 'trackingData');
    final String teamId = customData?['teamId'] ?? 'device_${DateTime.now().millisecondsSinceEpoch}';
    final String teamName = customData?['teamName'] ?? "Técnico";

    _socket = IO.io(kServerUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': true,
      'forceNew': true,
    });

    _socket?.onConnect((_) {
      print('Background Socket Connected');
      _socket?.emit('register_team', {'teamId': teamId, 'name': teamName});
      FlutterForegroundTask.updateService(
        notificationTitle: 'Mundonet Tracker [ON]',
        notificationText: 'Conectado ao servidor',
      );
    });

    _socket?.onConnectError((err) {
      FlutterForegroundTask.updateService(
        notificationTitle: 'Mundonet Tracker [ERRO]',
        notificationText: 'Erro de conexão: $err',
      );
    });

    _positionStream = Geolocator.getPositionStream(
      locationSettings: AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 0,
        intervalDuration: const Duration(seconds: 5),
      )
    ).listen((Position position) async {
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
      }
      
      FlutterForegroundTask.updateService(
        notificationTitle: 'Mundonet Tracker • OK',
        notificationText: 'Localização enviada às ${DateTime.now().hour}:${DateTime.now().minute}:${DateTime.now().second}',
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
        scaffoldBackgroundColor: const Color(0xFF0B0E14),
        primaryColor: const Color(0xFF39B8FF),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF39B8FF), 
          secondary: Color(0xFF002D62),
        ),
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
    _loadStoredName();
    _initForegroundTask();
    _checkStatus();
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
    if (!await FlutterForegroundTask.isIgnoringBatteryOptimizations) {
      await FlutterForegroundTask.requestIgnoreBatteryOptimization();
    }
    setState(() => _isRunning = running);
  }

  Future<void> _start() async {
    if (_controller.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor, identifique o técnico/veículo')),
      );
      return;
    }
    
    // Solicitar permissões críticas para Android 13
    await Permission.notification.request();
    var status = await Permission.location.request();
    if (status.isDenied) return;

    var backgroundStatus = await Permission.locationAlways.request();
    if (backgroundStatus.isDenied) {
      // No Android 13+ isso geralmente exige que o usuário vá nas configurações
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ative "Permitir o tempo todo" nas configurações de localização'),
          duration: Duration(seconds: 5),
        ),
      );
      await openAppSettings();
      return;
    }
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('currentTeamName', _controller.text);
    String? teamId = prefs.getString('deviceTeamId');
    if (teamId == null) {
      teamId = 'team_${DateTime.now().millisecondsSinceEpoch}';
      await prefs.setString('deviceTeamId', teamId);
    }
    
    // Passar os dados para o Isolate de segundo plano
    await FlutterForegroundTask.saveData(key: 'trackingData', value: {
      'teamId': teamId,
      'teamName': _controller.text
    });

    await FlutterForegroundTask.startService(
      notificationTitle: 'Mundonet Tracker',
      notificationText: 'Iniciando conexão...',
      callback: startCallback,
    );
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
        content: TextField(
          controller: pinController,
          obscureText: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            hintText: 'PIN de administrador',
            hintStyle: TextStyle(color: Colors.white24),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('CANCELAR')),
          TextButton(
            onPressed: () => Navigator.pop(context, pinController.text == '9910'), 
            child: const Text('CONFIRMAR', style: TextStyle(color: Color(0xFF39B8FF))),
          ),
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
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF002D62), Color(0xFF0B0E14)],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 30),
            child: Column(
              children: [
                const SizedBox(height: 60),
                Image.network(
                  'https://mundonetbandalarga.com.br/wp-content/uploads/2021/04/logo-mundonet.png',
                  height: 60,
                  errorBuilder: (context, error, stackTrace) => const Icon(Icons.location_on, size: 60, color: Color(0xFF39B8FF)),
                ),
                const SizedBox(height: 10),
                const Text('TRACKER SYSTEM v3.2', style: TextStyle(letterSpacing: 3, fontSize: 10, color: Colors.white30, fontWeight: FontWeight.bold)),
                const SizedBox(height: 80),
                
                Container(
                  padding: const EdgeInsets.all(30),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.03),
                    borderRadius: BorderRadius.circular(32),
                    border: Border.all(color: Colors.white10),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 10)),
                    ],
                  ),
                  child: Column(
                    children: [
                      _buildStatusIndicator(),
                      const SizedBox(height: 30),
                      if (!_isRunning) ...[
                        TextField(
                          controller: _controller,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w500),
                          decoration: InputDecoration(
                            hintText: 'Identificação (Ex: Tec. João)',
                            hintStyle: const TextStyle(color: Colors.white24),
                            filled: true,
                            fillColor: Colors.black26,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                          ),
                        ),
                        const SizedBox(height: 25),
                        SizedBox(
                          width: double.infinity, height: 60,
                          child: ElevatedButton(
                            onPressed: _start,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF39B8FF),
                              foregroundColor: const Color(0xFF002D62),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              elevation: 0,
                            ),
                            child: const Text('ATIVAR RASTREAMENTO', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                          ),
                        ),
                      ] else ...[
                        Text(
                          _controller.text.toUpperCase(), 
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: Colors.white),
                        ),
                        const SizedBox(height: 8),
                        const Text('DISPOSITIVO EM MONITORAMENTO', style: TextStyle(color: Color(0xFF34D399), fontSize: 12, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 40),
                        SizedBox(
                          width: double.infinity, height: 55,
                          child: OutlinedButton(
                            onPressed: _stop,
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Colors.white10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            child: const Text('INTERROMPER SERVIÇO', style: TextStyle(color: Colors.white30, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                
                const SizedBox(height: 40),
                _buildDiagnosticsCard(),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusIndicator() {
    return Container(
      width: 100, height: 100,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: _isRunning ? const Color(0xFF34D399).withOpacity(0.1) : Colors.white.withOpacity(0.05),
        border: Border.all(
          color: _isRunning ? const Color(0xFF34D399) : Colors.white10,
          width: 2,
        ),
      ),
      child: Icon(
        _isRunning ? Icons.radar : Icons.power_settings_new, 
        color: _isRunning ? const Color(0xFF34D399) : Colors.white24, 
        size: 50
      ),
    );
  }

  Widget _buildDiagnosticsCard() {
    return Container(
      padding: const EdgeInsets.all(25),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.analytics_outlined, size: 18, color: Color(0xFF39B8FF)),
              SizedBox(width: 10),
              Text('TELEMETRIA DO SISTEMA', style: TextStyle(fontSize: 11, color: Colors.white54, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
            ],
          ),
          const SizedBox(height: 20),
          _buildDiagRow('Status do Satélite', _isRunning ? 'Conectado' : 'Aguardando', Icons.satellite_alt),
          _buildDiagRow('Precisão do GPS', _isRunning ? 'Alta' : 'N/A', Icons.location_searching),
          _buildDiagRow('Envio de Dados', _isRunning ? 'Tempo Real' : 'Pausado', Icons.sync),
          _buildDiagRow('Modo de Energia', 'Otimizado', Icons.battery_saver),
        ],
      ),
    );
  }

  Widget _buildDiagRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: Colors.white24),
              const SizedBox(width: 10),
              Text(label, style: const TextStyle(fontSize: 13, color: Colors.white70)),
            ],
          ),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _isRunning ? const Color(0xFF39B8FF) : Colors.white30)),
        ],
      ),
    );
  }
}

