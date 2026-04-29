import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../ixc_api.dart';
import '../main.dart'; // Para importar a GpsTrackerApp/TrackerScreen

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _cpfController = TextEditingController();
  bool _isLoading = false;

  void _fazerLogin() async {
    if (_cpfController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor, digite o seu CPF')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final funcionario = await IxcApi.loginFuncionarioPorCPF(_cpfController.text);

    if (mounted) {
      setState(() {
        _isLoading = false;
      });

      if (funcionario != null) {
        // Salva os dados no celular
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('tecnico_id', funcionario['id'].toString());
        await prefs.setString('tecnico_nome', funcionario['funcionario'] ?? 'Técnico');
        
        // Vai para a tela principal
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const TrackerScreen()),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('CPF não encontrado no sistema. Tente novamente.'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(30.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.settings_system_daydream, size: 80, color: Color(0xFF39B8FF)),
              const SizedBox(height: 20),
              const Text(
                'MUNDONET SERVICE',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 2),
              ),
              const SizedBox(height: 10),
              const Text(
                'Autenticação de Técnico',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.white54),
              ),
              const SizedBox(height: 50),
              TextField(
                controller: _cpfController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Digite seu CPF',
                  hintStyle: const TextStyle(color: Colors.white24),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.05),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  prefixIcon: const Icon(Icons.badge, color: Colors.white30),
                ),
              ),
              const SizedBox(height: 30),
              SizedBox(
                height: 55,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _fazerLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF39B8FF),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isLoading 
                    ? const CircularProgressIndicator(color: Color(0xFF002D62))
                    : const Text('ENTRAR', style: TextStyle(color: Color(0xFF002D62), fontWeight: FontWeight.bold, fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
