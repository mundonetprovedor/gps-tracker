import 'dart:convert';
import 'package:http/http.dart' as http;

class IxcApi {
  static const String baseUrl = 'https://ixc.mundonetbandalarga.com.br/webservice/v1';
  static const String token = '156:16cdfe88a309a2505917855121d57c47629ff702cfc3c0dcc81e7540471505c8'; 
  
  static Map<String, String> get _headers {
    // O IXC usa Basic Auth. O token no IXC já é no formato 'usuario:senha' e precisa estar em Base64
    final String basicAuth = 'Basic ${base64Encode(utf8.encode(token))}';
    return {
      'Authorization': basicAuth,
      'Content-Type': 'application/json',
      'ixcsoft': 'listar' // Cabeçalho padrão do IXC para buscas
    };
  }

  // Busca cliente pelo Nome ou CPF
  static Future<List<dynamic>> buscarCliente(String query) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/cliente'),
        headers: _headers,
        body: jsonEncode({
          'qtype': 'cliente.razao', // Campo de busca (pode ser razao ou cnpj_cpf)
          'query': query,
          'oper': 'L', // Like
          'page': '1',
          'rp': '20',
          'sortname': 'cliente.id',
          'sortorder': 'desc'
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['registros'] != null) {
          return data['registros'];
        }
      }
      return [];
    } catch (e) {
      print('Erro ao buscar cliente: $e');
      return [];
    }
  }

  // Busca lista de colaboradores (técnicos/funcionários)
  static Future<List<dynamic>> buscarFuncionarios() async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/funcionarios'),
        headers: _headers,
        body: jsonEncode({
          'qtype': 'funcionarios.id',
          'query': '1',
          'oper': '>=',
          'page': '1',
          'rp': '1000',
          'sortname': 'funcionarios.id',
          'sortorder': 'asc' 
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['registros'] != null) {
          return data['registros'];
        }
      }
      return [];
    } catch (e) {
      print('Erro ao buscar funcionarios: $e');
      return [];
    }
  }

  // Faz o login verificando se o CPF existe na tabela de funcionários
  static Future<Map<String, dynamic>?> loginFuncionarioPorCPF(String cpf) async {
    try {
      // Limpa tudo o que não for número do CPF digitado
      String cleanCpfDigitado = cpf.replaceAll(RegExp(r'[^0-9]'), '');
      
      // Busca a lista de funcionários (limitado a 1000, suficiente para a maioria dos provedores)
      final listaFuncionarios = await buscarFuncionarios();

      // Procura na lista localmente comparando apenas os números
      for (var func in listaFuncionarios) {
        // IXC usa o campo 'cpf_cnpj' para armazenar o CPF de funcionários
        String cpfBanco = (func['cpf_cnpj'] ?? func['cpf'] ?? func['cnpj_cpf'] ?? '').toString().replaceAll(RegExp(r'[^0-9]'), '');
        
        if (cpfBanco == cleanCpfDigitado && cleanCpfDigitado.isNotEmpty) {
          return func; // Encontrou o funcionário!
        }
      }
      return null; // CPF não encontrado
    } catch (e) {
      print('Erro ao fazer login: $e');
      return null;
    }
  }


  // Busca o setor do colaborador
  static Future<List<dynamic>> buscarSetores(String usuarioId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/funcionario_setores'),
        headers: _headers,
        body: jsonEncode({
          'qtype': 'funcionario_setores.usuario',
          'query': usuarioId,
          'oper': '=',
          'page': '1',
          'rp': '1000',
          'sortname': 'funcionario_setores.id',
          'sortorder': 'desc'
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['registros'] != null) {
          return data['registros'];
        }
      }
      return [];
    } catch (e) {
      print('Erro ao buscar setores: $e');
      return [];
    }
  }

  // Busca todos os assuntos de O.S. e retorna como mapa {id -> nome}
  static Future<Map<String, String>> buscarAssuntos() async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/su_oss_assunto'),
        headers: _headers,
        body: jsonEncode({
          'qtype': 'su_oss_assunto.id',
          'query': '1',
          'oper': '>=',
          'page': '1',
          'rp': '1000',
          'sortname': 'su_oss_assunto.id',
          'sortorder': 'asc'
        }),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final Map<String, String> mapa = {};
        for (var item in (data['registros'] ?? [])) {
          mapa[item['id'].toString()] = item['assunto']?.toString() ?? '';
        }
        return mapa;
      }
      return {};
    } catch (e) {
      print('Erro ao buscar assuntos: $e');
      return {};
    }
  }

  // Busca dados do cliente pelo ID (Nome e Telefone)
  static Future<Map<String, String>> buscarDadosCliente(String clienteId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/cliente'),
        headers: _headers,
        body: jsonEncode({
          'qtype': 'cliente.id',
          'query': clienteId,
          'oper': '=',
          'page': '1',
          'rp': '1',
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['registros'] != null && (data['registros'] as List).isNotEmpty) {
          final c = data['registros'][0];
          return {
            'razao': c['razao']?.toString() ?? 'Cliente #$clienteId',
            'telefone': c['telefone_celular']?.toString() ?? c['telefone_comercial']?.toString() ?? '',
          };
        }
      }
      return {'razao': 'Cliente #$clienteId', 'telefone': ''};
    } catch (e) {
      return {'razao': 'Cliente #$clienteId', 'telefone': ''};
    }
  }

  // Busca O.S. (Suporte) com status AGENDADA do técnico logado, dentro de ±3 dias
  static Future<List<dynamic>> buscarMinhasOS(String tecnicoId) async {
    try {
      // Busca assuntos e OS em paralelo para economizar tempo
      final resultados = await Future.wait([
        http.post(
          Uri.parse('$baseUrl/su_oss_chamado'),
          headers: _headers,
          body: jsonEncode({
            'qtype': 'su_oss_chamado.id_tecnico',
            'query': tecnicoId,
            'oper': '=',
            'page': '1',
            'rp': '500',
            'sortname': 'su_oss_chamado.id',
            'sortorder': 'desc'
          }),
        ),
      ]);

      final assuntos = await buscarAssuntos();
      final response = resultados[0];

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['registros'] != null) {
          final List<dynamic> todas = data['registros'];
          final agora = DateTime.now();
          final limitePassado = agora.subtract(const Duration(days: 3));
          final limiteFuturo = agora.add(const Duration(days: 3));

          final filtradas = todas.where((os) {
            if (os['status'] != 'AG') return false;
            final String? dataStr = os['data_agenda'];
            if (dataStr == null || dataStr.isEmpty) return false;
            try {
              final dataAgenda = DateTime.parse(dataStr);
              return dataAgenda.isAfter(limitePassado) && dataAgenda.isBefore(limiteFuturo);
            } catch (_) {
              return false;
            }
          }).toList();

          // Resolve nomes de Assuntos e Dados de Clientes em paralelo
          await Future.wait(filtradas.map((os) async {
            // Assunto
            final idAssunto = os['id_assunto']?.toString() ?? '';
            os['assunto_nome'] = assuntos[idAssunto] ?? 'Assunto #$idAssunto';

            // Cliente (Busca o nome e telefone)
            final idCliente = os['id_cliente']?.toString() ?? '';
            if (idCliente.isNotEmpty) {
              final dados = await buscarDadosCliente(idCliente);
              os['cliente_razao'] = dados['razao'];
              os['cliente_telefone'] = dados['telefone'];
            }
          }));

          return filtradas;
        }
      }
      return [];
    } catch (e) {
      print('Erro ao buscar OS: $e');
      return [];
    }
  }

  // Faz upload de imagem na OS
  static Future<bool> anexarImagemOS(String osId, String base64Image) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/suporte_os_arquivos'),
        headers: {
          'Authorization': 'Basic ${base64Encode(utf8.encode(token))}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'id_suporte_os': osId,
          'arquivo': base64Image,
          'descricao': 'Foto anexa via Mundonet Service',
          // O IXC geralmente precisa do nome e tipo, isso varia conforme a versão da API
        }),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('Erro ao anexar imagem: $e');
      return false;
    }
  }
}
