import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../ixc_api.dart';

class ServiceOrdersTab extends StatefulWidget {
  const ServiceOrdersTab({Key? key}) : super(key: key);

  @override
  State<ServiceOrdersTab> createState() => _ServiceOrdersTabState();
}

class _ServiceOrdersTabState extends State<ServiceOrdersTab> {
  final ImagePicker _picker = ImagePicker();
  
  String? _tecnicoNome;
  List<dynamic> _orders = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _carregarDadosDoTecnico();
  }

  void _carregarDadosDoTecnico() async {
    final prefs = await SharedPreferences.getInstance();
    final String? id = prefs.getString('tecnico_id');
    final String? nome = prefs.getString('tecnico_nome');

    if (id != null) {
      setState(() {
        _tecnicoNome = nome;
      });
      _loadOrders(id);
    }
  }

  void _loadOrders(String tecnicoId) async {
    final resultados = await IxcApi.buscarMinhasOS(tecnicoId);

    if (mounted) {
      setState(() {
        _isLoading = false;
        _orders = resultados;
      });
    }
  }

  Future<void> _takePictureAndAttach(String osId) async {
    try {
      final XFile? photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 50);
      if (photo != null) {
        if (!mounted) return;
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enviando foto para o IXC...', style: TextStyle(color: Colors.white)), backgroundColor: Colors.blue, duration: Duration(seconds: 2)),
        );

        final bytes = await photo.readAsBytes();
        final base64Image = base64Encode(bytes);

        final sucesso = await IxcApi.anexarImagemOS(osId, base64Image);

        if (!mounted) return;
        if (sucesso) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Foto anexada na O.S. $osId com sucesso!', style: const TextStyle(color: Colors.white)), backgroundColor: Colors.green),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Falha ao enviar a foto para o IXC.', style: TextStyle(color: Colors.white)), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      debugPrint('Erro ao capturar foto: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF121212),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'MINHAS O.S.',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white70, letterSpacing: 1.5),
              ),
              const SizedBox(height: 5),
              Text(
                _tecnicoNome != null ? 'Técnico: $_tecnicoNome' : 'Carregando perfil...',
                style: const TextStyle(fontSize: 14, color: Color(0xFF39B8FF), fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 3),
              const Text(
                '📅 Agendadas — janela de ±3 dias',
                style: TextStyle(fontSize: 11, color: Colors.white30),
              ),
              const SizedBox(height: 20),
              if (_isLoading)
                const Center(child: CircularProgressIndicator(color: Color(0xFF39B8FF)))
              else if (_orders.isNotEmpty)
                Expanded(
                  child: ListView.builder(
                    itemCount: _orders.length,
                    itemBuilder: (context, index) {
                      final os = _orders[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 15),
                        padding: const EdgeInsets.all(15),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.02),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('O.S. #${os['id']}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF39B8FF))),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: _getStatusColor(os['status']).withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(_getStatusText(os['status']), style: TextStyle(color: _getStatusColor(os['status']), fontSize: 10, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              os['cliente_razao'] ?? 'Cliente #${os['id_cliente']}', 
                              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)
                            ),
                            if (os['cliente_telefone'] != null && os['cliente_telefone'].toString().isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4.0),
                                child: Text(
                                  os['cliente_telefone'].toString(),
                                  style: const TextStyle(color: Color(0xFF39B8FF), fontSize: 13, fontWeight: FontWeight.bold),
                                ),
                              ),
                            const SizedBox(height: 6),
                            // Data de agendamento
                            if (os['data_agenda'] != null && os['data_agenda'].toString().isNotEmpty)
                              Row(
                                children: [
                                  const Icon(Icons.calendar_today, size: 12, color: Colors.teal),
                                  const SizedBox(width: 5),
                                  Text(
                                    _formatarData(os['data_agenda'].toString()),
                                    style: const TextStyle(color: Colors.teal, fontSize: 12, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            const SizedBox(height: 5),
                            Row(
                              children: [
                                const Icon(Icons.build, size: 12, color: Colors.white30),
                                const SizedBox(width: 5),
                                Expanded(child: Text(os['assunto_nome'] ?? os['assunto'] ?? 'Assunto não definido', style: const TextStyle(color: Colors.white54, fontSize: 12))),
                              ],
                            ),
                            const SizedBox(height: 8),
                            // Endereço
                            if (os['endereco'] != null && os['endereco'].toString().isNotEmpty)
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.location_on, size: 12, color: Colors.redAccent),
                                  const SizedBox(width: 5),
                                  Expanded(
                                    child: Text(
                                      os['endereco'].toString(),
                                      style: const TextStyle(color: Colors.white70, fontSize: 11),
                                    ),
                                  ),
                                ],
                              ),
                            const SizedBox(height: 15),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                onPressed: () => _takePictureAndAttach(os['id'].toString()),
                                icon: const Icon(Icons.camera_alt, size: 16, color: Colors.white),
                                label: const Text('Anexar Foto na O.S.', style: TextStyle(color: Colors.white)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white10,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                )
              else if (_tecnicoNome != null)
                const Center(child: Text('Nenhuma O.S. encontrada', style: TextStyle(color: Colors.white54))),
            ],
          ),
        ),
      ),
    );
  }

  String _formatarData(String dataStr) {
    try {
      final d = DateTime.parse(dataStr);
      return '${d.day.toString().padLeft(2,'0')}/${d.month.toString().padLeft(2,'0')}/${d.year} às ${d.hour.toString().padLeft(2,'0')}:${d.minute.toString().padLeft(2,'0')}';
    } catch (_) {
      return dataStr;
    }
  }

  String _getStatusText(String? code) {
    switch (code) {
      case 'A': return 'Aberta';
      case 'AN': return 'Análise';
      case 'EN': return 'Encaminhada';
      case 'AS': return 'Assumida';
      case 'AG': return 'Agendada';
      case 'DS': return 'Deslocamento';
      case 'EX': return 'Execução';
      case 'F': return 'Finalizada';
      case 'RAG': return 'Aguardando Agendamento';
      default: return code ?? 'Desconhecido';
    }
  }

  Color _getStatusColor(String? code) {
    switch (code) {
      case 'A': return Colors.orange;
      case 'AN': return Colors.purpleAccent;
      case 'EN': return Colors.blueAccent;
      case 'AS': return Colors.cyanAccent;
      case 'AG': return Colors.teal;
      case 'DS': return Colors.yellowAccent;
      case 'EX': return Colors.lightGreen;
      case 'F': return Colors.green;
      case 'RAG': return Colors.redAccent;
      default: return Colors.white54;
    }
  }
}

