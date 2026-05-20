import 'dart:async';
import 'dart:isolate';
import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/services.dart';

import 'dart:ui';

const String kServerUrl = "https://mapa.mundonetbandalarga.com.br";

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MundonetOsApp());
}

@pragma('vm:entry-point')
void startCallback() {
  DartPluginRegistrant.ensureInitialized();
  FlutterForegroundTask.setTaskHandler(GpsTaskHandler());
}

class GpsTaskHandler extends TaskHandler {
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
    _sendLog('1. Sincronizador iniciado');
    
    try {
      final prefs = await SharedPreferences.getInstance();
      final String teamId = prefs.getString('currentTeamId') ?? '';
      final String teamName = prefs.getString('currentTeamName') ?? 'Colaborador';
      
      _sendLog('2. Colaborador: $teamName (ID: $teamId)');
      _sendLog('3. Carregando recursos do sistema...');
      
      LocationPermission permission = await Geolocator.checkPermission();
      _sendLog('4. Permissão de Sistema: $permission');

      // Envia atualização inicial
      if (teamId.isNotEmpty) {
        _sendCurrentLocation(teamId);
      }

      _positionStream = Geolocator.getPositionStream(
        locationSettings: AndroidSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 3,
          intervalDuration: const Duration(seconds: 5),
        )
      ).listen((Position position) async {
        _sendLog('5. GPS: OK 📍');
        if (teamId.isNotEmpty) {
          await _sendTelemetry(teamId, position);
        }
      }, onError: (err) => _sendLog('ERRO GPS: $err ❌'));
      
    } catch (e) {
      _sendLog('ERRO FATAL: $e');
    }
  }

  @override
  void onDestroy(DateTime timestamp, SendPort? sendPort) async {
    _sendLog('Serviço finalizado');
    await _positionStream?.cancel();
  }
  
  @override
  void onRepeatEvent(DateTime timestamp, SendPort? sendPort) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final String teamId = prefs.getString('currentTeamId') ?? '';
      if (teamId.isNotEmpty) {
        _sendCurrentLocation(teamId);
      }
    } catch (e) {
      _sendLog('Erro Repeat: $e');
    }
  }

  Future<void> _sendCurrentLocation(String teamId) async {
    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 5),
      );
      _sendLog('Conexão (Ping): OK ⚡');
      await _sendTelemetry(teamId, position);
    } catch (e) {
      _sendLog('Erro de Localização: $e');
    }
  }

  Future<void> _sendTelemetry(String teamId, Position position) async {
    int battLevel = await _battery.batteryLevel;
    try {
      final url = Uri.parse('$kServerUrl/traccar').replace(
        queryParameters: {
          'id': teamId,
          'lat': position.latitude.toString(),
          'lon': position.longitude.toString(),
          'speed': (position.speed * 1.94384).toString(), // m/s to knots
          'heading': position.heading.toString(),
          'battery': battLevel.toString(),
        },
      );

      final response = await http.get(url).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        _sendLog('Dados Sincronizados 🚀');
        
        final bodyText = response.body;
        if (bodyText.startsWith('NOTIFICATION|')) {
          final parts = bodyText.split('|');
          if (parts.length >= 3) {
            final title = parts[1];
            final body = parts[2];
            _sendLog('🔔 Notificação: $title');
            
            HapticFeedback.vibrate();
            SystemSound.play(SystemSoundType.click);
            
            FlutterForegroundTask.updateService(
              notificationTitle: title,
              notificationText: body,
            );
          }
        }
      } else {
        _sendLog('Erro de Conexão: ${response.statusCode} ❌');
      }
    } catch (e) {
      _sendLog('Erro ao Sincronizar: $e ❌');
    }
  }
}

class MundonetOsApp extends StatelessWidget {
  const MundonetOsApp({Key? key}) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Mundonet OS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B0E14),
        primaryColor: const Color(0xFF39B8FF),
        colorScheme: const ColorScheme.dark(primary: Color(0xFF39B8FF), secondary: Color(0xFF002D62)),
      ),
      home: const SyncScreen(),
    );
  }
}

class SyncScreen extends StatefulWidget {
  const SyncScreen({Key? key}) : super(key: key);
  @override
  State<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends State<SyncScreen> {
  final TextEditingController _idController = TextEditingController();
  final TextEditingController _controller = TextEditingController();
  bool _isRunning = false;
  final List<String> _logs = [];
  ReceivePort? _receivePort;

  @override
  void initState() {
    super.initState();
    _loadStoredData();
    _initForegroundTask();
    _checkStatus();
  }

  @override
  void dispose() {
    _closeReceivePort();
    _idController.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _closeReceivePort() {
    _receivePort?.close();
    _receivePort = null;
  }

  Future<void> _loadStoredData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _controller.text = prefs.getString('currentTeamName') ?? "";
      _idController.text = prefs.getString('currentTeamId') ?? "";
    });
  }

  void _initForegroundTask() {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'mundonet_os_sync',
        channelName: 'Mundonet OS Sincronização',
        channelImportance: NotificationChannelImportance.HIGH, 
        priority: NotificationPriority.HIGH,
        isSticky: true,
        visibility: NotificationVisibility.VISIBILITY_PUBLIC,
        iconData: const NotificationIconData(
          resType: ResourceType.mipmap,
          resPrefix: ResourcePrefix.ic,
          name: 'launcher',
          backgroundColor: Color(0xFF34D399),
        ),
      ),
      iosNotificationOptions: const IOSNotificationOptions(showNotification: true),
      foregroundTaskOptions: const ForegroundTaskOptions(
        interval: 5000, 
        allowWakeLock: false,
        allowWifiLock: false,
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
    if (_idController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Digite o ID do Colaborador (IXC)')));
      return;
    }
    if (_controller.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Identifique o nome do colaborador')));
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
    await prefs.setString('currentTeamName', _controller.text.trim());
    await prefs.setString('currentTeamId', _idController.text.trim());
    
    await FlutterForegroundTask.saveData(key: 'trackingData', value: {
      'teamId': _idController.text.trim(),
      'teamName': _controller.text.trim()
    });

    final bool result = await FlutterForegroundTask.startService(
      notificationTitle: 'Mundonet OS',
      notificationText: 'Sincronização de O.S. ativa',
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
        title: const Text('Desconectar Integração'),
        content: TextField(controller: pinController, obscureText: true, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'Código de autorização')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('CANCELAR')),
          TextButton(onPressed: () => Navigator.pop(context, pinController.text == '9910'), child: const Text('OK')),
        ],
      ),
    );

    if (confirm == true) {
      final prefs = await SharedPreferences.getInstance();
      final String teamId = prefs.getString('currentTeamId') ?? '';
      if (teamId.isNotEmpty) {
        try {
          final url = Uri.parse('$kServerUrl/traccar').replace(
            queryParameters: {
              'id': teamId,
              'offline': 'true',
            },
          );
          await http.get(url).timeout(const Duration(seconds: 5));
        } catch (e) {
          print('Erro ao desativar online: $e');
        }
      }

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
                  Image.network('https://mundonetbandalarga.com.br/wp-content/uploads/2021/04/logo-mundonet.png', height: 50, errorBuilder: (c, e, s) => const Icon(Icons.sync, size: 50, color: Color(0xFF39B8FF))),
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
            TextField(
              controller: _idController,
              textAlign: TextAlign.center,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: 'ID do Colaborador (IXC)',
                filled: true,
                fillColor: Colors.black26,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)
              ),
            ),
            const SizedBox(height: 15),
            TextField(
              controller: _controller,
              textAlign: TextAlign.center,
              decoration: InputDecoration(
                hintText: 'Nome do Colaborador',
                filled: true,
                fillColor: Colors.black26,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(width: double.infinity, height: 55, child: ElevatedButton(onPressed: _start, style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF39B8FF), foregroundColor: Colors.black), child: const Text('CONECTAR AO IXC', style: TextStyle(fontWeight: FontWeight.bold)))),
          ] else ...[
            Text(_controller.text.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            Text('ID IXC: ${_idController.text}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 10),
            const Text('INTEGRAÇÃO ATIVA', style: TextStyle(color: Color(0xFF34D399), fontSize: 11)),
            const SizedBox(height: 30),
            OutlinedButton(onPressed: _stop, style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white10)), child: const Text('DESCONECTAR', style: TextStyle(color: Colors.white30))),
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
          const Text('LOG DE SINCRONIZAÇÃO', style: TextStyle(fontSize: 9, color: Colors.white30, fontWeight: FontWeight.bold)),
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
      child: Icon(_isRunning ? Icons.sync : Icons.power_settings_new, color: _isRunning ? const Color(0xFF34D399) : Colors.white24, size: 40),
    );
  }

  Widget _buildDiagnosticsCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.02), borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white10)),
      child: Column(
        children: [
          _buildDiagRow('Sinal de Serviço', _isRunning ? 'OK' : '--', Icons.wifi_tethering),
          _buildDiagRow('Sincronização', 'Automática', Icons.timer_outlined),
          _buildDiagRow('Nuvem IXC', 'Conectado', Icons.cloud_queue),
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
