import 'package:flutter/material.dart';
import '../ixc_api.dart';

class ClientLookupTab extends StatefulWidget {
  const ClientLookupTab({Key? key}) : super(key: key);

  @override
  State<ClientLookupTab> createState() => _ClientLookupTabState();
}

class _ClientLookupTabState extends State<ClientLookupTab> {
  final TextEditingController _searchController = TextEditingController();
  bool _isLoading = false;
  List<dynamic> _searchResults = [];

  void _searchClient() async {
    if (_searchController.text.isEmpty) return;

    setState(() {
      _isLoading = true;
      _searchResults = [];
    });

    final resultados = await IxcApi.buscarCliente(_searchController.text);

    setState(() {
      _isLoading = false;
      _searchResults = resultados;
    });
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
                'RAIO-X CLIENTE',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white70, letterSpacing: 1.5),
              ),
              const SizedBox(height: 5),
              const Text(
                'Consulta de sinal e status via IXC',
                style: TextStyle(fontSize: 12, color: Colors.white30),
              ),
              const SizedBox(height: 25),
              TextField(
                controller: _searchController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Digite CPF, CNPJ ou Nome...',
                  hintStyle: const TextStyle(color: Colors.white24),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.05),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  prefixIcon: const Icon(Icons.search, color: Colors.white30),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.arrow_forward_ios, size: 16, color: Color(0xFF39B8FF)),
                    onPressed: _searchClient,
                  ),
                ),
                onSubmitted: (_) => _searchClient(),
              ),
              const SizedBox(height: 30),
              if (_isLoading)
                const Center(child: CircularProgressIndicator(color: Color(0xFF39B8FF)))
              else if (_searchResults.isNotEmpty)
                Expanded(
                  child: ListView.builder(
                    itemCount: _searchResults.length,
                    itemBuilder: (context, index) {
                      final cliente = _searchResults[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 15),
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.02),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildInfoRow('Nome / Razão', cliente['razao'] ?? 'N/A', Icons.person),
                            _buildInfoRow('CNPJ / CPF', cliente['cnpj_cpf'] ?? 'N/A', Icons.badge),
                            const Divider(color: Colors.white10, height: 30),
                            _buildInfoRow('ID do Cliente', cliente['id'] ?? 'N/A', Icons.numbers),
                            _buildInfoRow('Telefone', cliente['telefone_celular'] ?? 'N/A', Icons.phone),
                          ],
                        ),
                      );
                    },
                  ),
                )
              else if (_searchController.text.isNotEmpty)
                const Center(child: Text('Nenhum cliente encontrado', style: TextStyle(color: Colors.white54))),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color ?? Colors.white30),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, color: Colors.white30)),
                const SizedBox(height: 2),
                Text(value, style: TextStyle(fontSize: 14, color: color ?? Colors.white70, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
