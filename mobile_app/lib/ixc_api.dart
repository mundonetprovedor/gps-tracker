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

  // Busca O.S. (Suporte) associadas ao técnico logado
  static Future<List<dynamic>> buscarMinhasOS(String tecnicoId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/su_oss_chamado'),
        headers: _headers,
        body: jsonEncode({
          'qtype': 'su_oss_chamado.id_tecnico', // Busca pelo ID do técnico
          'query': tecnicoId,
          'oper': '=',
          'page': '1',
          'rp': '50',
          'sortname': 'su_oss_chamado.id',
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
