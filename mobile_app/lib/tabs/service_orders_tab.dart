import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../ixc_api.dart';

class ServiceOrdersTab extends StatefulWidget {
  const ServiceOrdersTab({Key? key}) : super(key: key);

  @override
  State<ServiceOrdersTab> createState() => _ServiceOrdersTabState();
}

class _ServiceOrdersTabState extends State<ServiceOrdersTab> {
  final ImagePicker _picker = ImagePicker();
  
  List<dynamic> _funcionarios = [];
  String? _selectedFuncionarioId;
  List<dynamic> _orders = [];
  bool _isLoading = false;
  bool _isLoadingFuncionarios = true;

  @override
  void initState() {
    super.initState();
    _carregarFuncionarios();
  }

  void _carregarFuncionarios() async {
    final func = await IxcApi.buscarFuncionarios();
    if (mounted) {
      setState(() {
        _funcionarios = func;
        _isLoadingFuncionarios = false;
      });
    }
  }

  void _loadOrders(String tecnicoId) async {
    setState(() {
      _isLoading = true;
      _orders = [];
    });

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
              const Text(
                'Selecione seu perfil para ver as O.S.',
                style: TextStyle(fontSize: 12, color: Colors.white30),
              ),
              const SizedBox(height: 15),
              
              if (_isLoadingFuncionarios)
                const Center(child: CircularProgressIndicator(color: Color(0xFF39B8FF)))
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 15),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      dropdownColor: const Color(0xFF1E1E1E),
                      value: _selectedFuncionarioId,
                      hint: const Text('Selecione o Técnico', style: TextStyle(color: Colors.white54)),
                      items: _funcionarios.map((func) {
                        return DropdownMenuItem<String>(
                          value: func['id'].toString(),
                          child: Text(func['funcionario'] ?? 'Sem Nome', style: const TextStyle(color: Colors.white)),
                        );
                      }).toList(),
                      onChanged: (value) {
                        setState(() {
                          _selectedFuncionarioId = value;
                        });
                        if (value != null) {
                          _loadOrders(value);
                        }
                      },
                    ),
                  ),
                ),
              
              const SizedBox(height: 25),
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
                                    color: Colors.orange.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(os['status'] == 'A' ? 'Aberta' : os['status'], style: const TextStyle(color: Colors.orange, fontSize: 10, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(os['cliente_razao'] ?? 'Cliente Desconhecido', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 5),
                            Row(
                              children: [
                                const Icon(Icons.build, size: 12, color: Colors.white30),
                                const SizedBox(width: 5),
                                Expanded(child: Text(os['assunto'] ?? 'Assunto não definido', style: const TextStyle(color: Colors.white54, fontSize: 12))),
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
              else if (_selectedFuncionarioId != null)
                const Center(child: Text('Nenhuma O.S. encontrada', style: TextStyle(color: Colors.white54))),
            ],
          ),
        ),
      ),
    );
  }
}
