import type { TeamMember, ServiceOrder, DashboardStats, Alert, IncidentCluster } from '@/types'
import { getTodayDateString } from '@/lib/utils'

const TODAY = getTodayDateString()

export const MOCK_TEAMS: Record<string, TeamMember> = {
  'colab-1': { id: 'colab-1', name: 'ANTONIO PEDRO SILVA NETO', status: 'Disponível', techs: ['Antonio Pedro'], phone: '(98) 98812-1001', vehicle: 'Uno 1.0', plate: 'HPX-1001' },
  'colab-2': { id: 'colab-2', name: 'CAIO ALMEIDA MENEZES', status: 'Executando atendimento', techs: ['Caio Almeida'], phone: '(98) 98812-1002', vehicle: 'Bros 160', plate: 'HPX-1002' },
  'colab-3': { id: 'colab-3', name: 'ELIAS GONCALVES RIBEIRO', status: 'Disponível', techs: ['Elias Gonçalves'], phone: '(98) 98812-1003', vehicle: 'Uno 1.0', plate: 'HPX-1003' },
  'colab-4': { id: 'colab-4', name: 'GABRIEL DE SOUSA BARROS', status: 'Disponível', techs: ['Gabriel Sousa'], phone: '(98) 98812-1004', vehicle: 'Saveiro', plate: 'HPX-1004' },
  'colab-5': { id: 'colab-5', name: 'IVALDO MAIA MENDES', status: 'Em deslocamento', techs: ['Ivaldo Maia'], phone: '(98) 98812-1005', vehicle: 'Uno 1.0', plate: 'HPX-1005' },
  'colab-6': { id: 'colab-6', name: 'JAILSON SANTOS SILVA', status: 'Executando atendimento', techs: ['Jailson Santos'], phone: '(98) 98812-1006', vehicle: 'Strada', plate: 'HPX-1006' },
  'colab-7': { id: 'colab-7', name: 'JOAO VITOR MENDES MARTINS(Juninho)', status: 'Disponível', techs: ['João Vitor Juninho'], phone: '(98) 98812-1007', vehicle: 'Bros 160', plate: 'HPX-1007' },
  'colab-8': { id: 'colab-8', name: 'JONATAS SILVA PASSO', status: 'Executando atendimento', techs: ['Jonatas Passo'], phone: '(98) 98812-1008', vehicle: 'Furgão Master', plate: 'HPX-1008' },
  'colab-9': { id: 'colab-9', name: 'JULIO CESAR LIMA DOS SANTOS', status: 'Disponível', techs: ['Julio Cesar'], phone: '(98) 98812-1009', vehicle: 'Uno 1.0', plate: 'HPX-1009' },
  'colab-10': { id: 'colab-10', name: 'LUCAS DE MOURA BRAGA', status: 'Disponível', techs: ['Lucas Moura'], phone: '(98) 98812-1010', vehicle: 'Fazer 250', plate: 'HPX-1010' },
  'colab-11': { id: 'colab-11', name: 'MARCELINO SOUSA DOS SANTOS', status: 'Executando atendimento', techs: ['Marcelino Sousa'], phone: '(98) 98812-1011', vehicle: 'Strada Fusion', plate: 'HPX-1011' },
  'colab-12': { id: 'colab-12', name: 'MATHEUS MORAES DOS SANTOS', status: 'Executando atendimento', techs: ['Matheus Moraes'], phone: '(98) 98812-1012', vehicle: 'Saveiro Tech', plate: 'HPX-1012' },
  'colab-13': { id: 'colab-13', name: 'MOISES COELHO SOARES', status: 'Executando atendimento', techs: ['Moises Coelho'], phone: '(98) 98812-1013', vehicle: 'Uno 1.0', plate: 'HPX-1013' },
  'colab-14': { id: 'colab-14', name: 'RAFAEL CUNHA DOS SANTOS', status: 'Disponível', techs: ['Rafael Cunha'], phone: '(98) 98812-1014', vehicle: 'Crosser 150', plate: 'HPX-1014' },
  'colab-15': { id: 'colab-15', name: 'RAMON BRENDON FREITAS COSTA', status: 'Disponível', techs: ['Ramon Costa'], phone: '(98) 98812-1015', vehicle: 'Uno 1.0', plate: 'HPX-1015' },
  'colab-16': { id: 'colab-16', name: 'ROMARIO COELHO SOUZA', status: 'Em deslocamento', techs: ['Romario Souza'], phone: '(98) 98812-1016', vehicle: 'Bros 160', plate: 'HPX-1016' },
  'colab-17': { id: 'colab-17', name: 'SILVAN DOS SANTOS MONTEIRO', status: 'Disponível', techs: ['Silvan Monteiro'], phone: '(98) 98812-1017', vehicle: 'Uno 1.0', plate: 'HPX-1017' },
  'colab-18': { id: 'colab-18', name: 'WALLACE EVERTON GOMES', status: 'Executando atendimento', techs: ['Wallace Gomes'], phone: '(98) 98812-1018', vehicle: 'Master Furgão', plate: 'HPX-1018' },
  'colab-19': { id: 'colab-19', name: 'WANDERSON DA SILVA MARINHO', status: 'Executando atendimento', techs: ['Wanderson Marinho'], phone: '(98) 98812-1019', vehicle: 'Strada', plate: 'HPX-1019' },
  'colab-20': { id: 'colab-20', name: 'WLADIMIR AIRES OLIVEIRA', status: 'Executando atendimento', techs: ['Wladimir Oliveira'], phone: '(98) 98812-1020', vehicle: 'Saveiro', plate: 'HPX-1020' },
}

export const MOCK_ORDERS: ServiceOrder[] = [
  // ANTONIO PEDRO SILVA NETO
  {
    ixcId: 'os-201', number: '98501', client: 'CANCELADO', address: 'Rua Central, 12', neighborhood: 'Renascença', city: 'São Luís',
    subject: 'CANCELADO', category: 'Sem conexão', priority: 'baixa', status: 'F', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '08:00', scheduledTimeEnd: '08:45', durationMinutes: 45
  },
  {
    ixcId: 'os-202', number: '98502', client: 'CANCELADO', address: 'Rua das Flores, 44', neighborhood: 'Renascença', city: 'São Luís',
    subject: 'CANCELADO', category: 'Lentidão', priority: 'baixa', status: 'F', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '10:15', scheduledTimeEnd: '10:45', durationMinutes: 30
  },
  {
    ixcId: 'os-203', number: '98503', client: 'CANCELADO', address: 'Av. Holandeses, 500', neighborhood: 'Calhau', city: 'São Luís',
    subject: 'CANCELADO', category: 'Configuração de roteador', priority: 'baixa', status: 'F', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '11:00', scheduledTimeEnd: '11:30', durationMinutes: 30
  },
  {
    ixcId: 'os-204', number: '98504', client: 'CANCELADO', address: 'Rua Sol, 120', neighborhood: 'Centro', city: 'São Luís',
    subject: 'CANCELADO', category: 'Sem conexão', priority: 'baixa', status: 'F', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '14:30', scheduledTimeEnd: '15:15', durationMinutes: 45
  },
  {
    ixcId: 'os-205', number: '98505', client: 'CANCELADO', address: 'Rua Paz, 88', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'CANCELADO', category: 'Fibra rompida', priority: 'baixa', status: 'F', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '15:15', scheduledTimeEnd: '15:45', durationMinutes: 30
  },
  {
    ixcId: 'os-206', number: '98506', client: 'CANCELADO', address: 'Av. Colares Moreira, 300', neighborhood: 'Renascença', city: 'São Luís',
    subject: 'CANCELADO', category: 'Lentidão', priority: 'baixa', status: 'F', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '15:45', scheduledTimeEnd: '16:15', durationMinutes: 30
  },
  {
    ixcId: 'os-207', number: '98507', client: 'CANCELADO', address: 'Rua Palma, 5', neighborhood: 'Centro', city: 'São Luís',
    subject: 'CANCELADO', category: 'Mudança de endereço', priority: 'baixa', status: 'F', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '16:15', scheduledTimeEnd: '16:45', durationMinutes: 30
  },
  {
    ixcId: 'os-208', number: '98508', client: 'CANCELADO', address: 'Av. Daniel, 1020', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'CANCELADO', category: 'Configuração de roteador', priority: 'baixa', status: 'F', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '17:00', scheduledTimeEnd: '17:30', durationMinutes: 30
  },
  {
    ixcId: 'os-209', number: '98509', client: 'CANCELADO', address: 'Rua Estrela, 40', neighborhood: 'Vinhais', city: 'São Luís',
    subject: 'CANCELADO', category: 'Sem conexão', priority: 'baixa', status: 'F', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '17:30', scheduledTimeEnd: '18:00', durationMinutes: 30
  },
  {
    ixcId: 'os-210', number: '98510', client: 'CARLOS JOSE', address: 'Rua do Mar, 21', neighborhood: 'Turu', city: 'São Luís',
    subject: 'SEM INTERNET', category: 'Sem conexão', priority: 'alta', status: 'A', teamId: 'colab-1', collaboratorName: 'ANTONIO PEDRO SILVA NETO',
    scheduledDate: TODAY, scheduledTimeStart: '14:00', scheduledTimeEnd: '14:30', durationMinutes: 30
  },

  // CAIO ALMEIDA MENEZES
  {
    ixcId: 'os-211', number: '98511', client: 'MARCOS', address: 'Rua 1, Qda 4', neighborhood: 'Vinhais', city: 'São Luís',
    subject: 'NOVA INSTALAÇÃO', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-2', collaboratorName: 'CAIO ALMEIDA MENEZES',
    scheduledDate: TODAY, scheduledTimeStart: '08:00', scheduledTimeEnd: '08:30', durationMinutes: 30
  },
  {
    ixcId: 'os-212', number: '98512', client: 'ANA', address: 'Rua 2, Qda 5', neighborhood: 'Vinhais', city: 'São Luís',
    subject: 'NOVA INSTALAÇÃO', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-2', collaboratorName: 'CAIO ALMEIDA MENEZES',
    scheduledDate: TODAY, scheduledTimeStart: '08:30', scheduledTimeEnd: '09:00', durationMinutes: 30
  },
  {
    ixcId: 'os-213', number: '98513', client: 'BRUNO', address: 'Rua 3, Qda 6', neighborhood: 'Vinhais', city: 'São Luís',
    subject: 'NOVA INSTALAÇÃO', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-2', collaboratorName: 'CAIO ALMEIDA MENEZES',
    scheduledDate: TODAY, scheduledTimeStart: '09:00', scheduledTimeEnd: '09:30', durationMinutes: 30
  },
  {
    ixcId: 'os-214', number: '98514', client: 'CARLA', address: 'Rua 4, Qda 7', neighborhood: 'Vinhais', city: 'São Luís',
    subject: 'NOVA INSTALAÇÃO', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-2', collaboratorName: 'CAIO ALMEIDA MENEZES',
    scheduledDate: TODAY, scheduledTimeStart: '09:30', scheduledTimeEnd: '10:00', durationMinutes: 30
  },
  {
    ixcId: 'os-215', number: '98515', client: 'DANIEL', address: 'Rua 5, Qda 8', neighborhood: 'Vinhais', city: 'São Luís',
    subject: 'NOVA INSTALAÇÃO', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-2', collaboratorName: 'CAIO ALMEIDA MENEZES',
    scheduledDate: TODAY, scheduledTimeStart: '10:00', scheduledTimeEnd: '10:30', durationMinutes: 30
  },
  {
    ixcId: 'os-216', number: '98516', client: 'EDUARDO', address: 'Rua 6, Qda 9', neighborhood: 'Vinhais', city: 'São Luís',
    subject: 'NOVA INSTALAÇÃO', category: 'Instalação', priority: 'media', status: 'EX', teamId: 'colab-2', collaboratorName: 'CAIO ALMEIDA MENEZES',
    scheduledDate: TODAY, scheduledTimeStart: '10:30', scheduledTimeEnd: '11:00', durationMinutes: 30
  },

  // IVALDO MAIA MENDES
  {
    ixcId: 'os-217', number: '98517', client: 'JOANA SILVA', address: 'Av. Guajajaras, 88', neighborhood: 'Tirirical', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-5', collaboratorName: 'IVALDO MAIA MENDES',
    scheduledDate: TODAY, scheduledTimeStart: '09:30', scheduledTimeEnd: '10:30', durationMinutes: 60
  },
  {
    ixcId: 'os-218', number: '98518', client: 'RODRIGO ALVES', address: 'Rua da Paz, 102', neighborhood: 'Tirirical', city: 'São Luís',
    subject: 'SEM INTERNET', category: 'Sem conexão', priority: 'alta', status: 'F', teamId: 'colab-5', collaboratorName: 'IVALDO MAIA MENDES',
    scheduledDate: TODAY, scheduledTimeStart: '10:45', scheduledTimeEnd: '11:30', durationMinutes: 45
  },
  {
    ixcId: 'os-219', number: '98519', client: 'LUCIA SANTOS', address: 'Av. Holandeses, 99', neighborhood: 'Calhau', city: 'São Luís',
    subject: 'MUDANÇA DE ENDEREÇO', category: 'Mudança de endereço', priority: 'media', status: 'EX', teamId: 'colab-5', collaboratorName: 'IVALDO MAIA MENDES',
    scheduledDate: TODAY, scheduledTimeStart: '17:00', scheduledTimeEnd: '18:00', durationMinutes: 60
  },

  // JAILSON SANTOS SILVA
  {
    ixcId: 'os-220', number: '98520', client: 'FRANCISCO LIMA', address: 'Rua do Sol, 400', neighborhood: 'Centro', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-6', collaboratorName: 'JAILSON SANTOS SILVA',
    scheduledDate: TODAY, scheduledTimeStart: '08:30', scheduledTimeEnd: '10:00', durationMinutes: 90
  },
  {
    ixcId: 'os-221', number: '98521', client: 'THAYNA CORREA', address: 'Rua das Hortênsias, 12', neighborhood: 'Calhau', city: 'São Luís',
    subject: 'SEM INTERNET::THAYNA', category: 'Sem conexão', priority: 'critica', status: 'F', teamId: 'colab-6', collaboratorName: 'JAILSON SANTOS SILVA',
    scheduledDate: TODAY, scheduledTimeStart: '10:15', scheduledTimeEnd: '11:45', durationMinutes: 90
  },
  {
    ixcId: 'os-222', number: '98522', client: 'VALERIA SOUZA', address: 'Av. Colares Moreira, 89', neighborhood: 'Renascença', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'EX', teamId: 'colab-6', collaboratorName: 'JAILSON SANTOS SILVA',
    scheduledDate: TODAY, scheduledTimeStart: '15:00', scheduledTimeEnd: '16:15', durationMinutes: 75
  },
  {
    ixcId: 'os-223', number: '98523', client: 'REGINA MENDES', address: 'Av. Daniel de La Touche, 55', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'A', teamId: 'colab-6', collaboratorName: 'JAILSON SANTOS SILVA',
    scheduledDate: TODAY, scheduledTimeStart: '16:15', scheduledTimeEnd: '17:30', durationMinutes: 75
  },

  // JONATAS SILVA PASSO
  {
    ixcId: 'os-224', number: '98524', client: 'PEDRO CELSO', address: 'Rua das Palmas, 88', neighborhood: 'Turu', city: 'São Luís',
    subject: 'SEM INTERNET::PEDRO CELSO', category: 'Sem conexão', priority: 'critica', status: 'F', teamId: 'colab-8', collaboratorName: 'JONATAS SILVA PASSO',
    scheduledDate: TODAY, scheduledTimeStart: '08:00', scheduledTimeEnd: '09:30', durationMinutes: 90
  },
  {
    ixcId: 'os-225', number: '98525', client: 'RAIMUNDA COSTA', address: 'Rua da Areia, 15', neighborhood: 'Anjo da Guarda', city: 'São Luís',
    subject: 'Sinal Ruim::RAIMUNDA C', category: 'Lentidão', priority: 'media', status: 'F', teamId: 'colab-8', collaboratorName: 'JONATAS SILVA PASSO',
    scheduledDate: TODAY, scheduledTimeStart: '10:30', scheduledTimeEnd: '11:45', durationMinutes: 75
  },
  {
    ixcId: 'os-226', number: '98526', client: 'MATEUS MORAES', address: 'Av. dos Holandeses, 400', neighborhood: 'Calhau', city: 'São Luís',
    subject: 'UPGRADE / TROCA DE PLANO', category: 'Configuração de roteador', priority: 'baixa', status: 'EX', teamId: 'colab-8', collaboratorName: 'JONATAS SILVA PASSO',
    scheduledDate: TODAY, scheduledTimeStart: '15:00', scheduledTimeEnd: '16:30', durationMinutes: 90
  },

  // MARCELINO SOUSA DOS SANTOS
  {
    ixcId: 'os-227', number: '98527', client: 'CLAUDIA ROCHA', address: 'Rua 8, Qda 12', neighborhood: 'Vinhais', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-11', collaboratorName: 'MARCELINO SOUSA DOS SANTOS',
    scheduledDate: TODAY, scheduledTimeStart: '07:30', scheduledTimeEnd: '09:00', durationMinutes: 90
  },
  {
    ixcId: 'os-228', number: '98528', client: 'EDILEUZA NASCIMENTO', address: 'Av. Colares Moreira, 1500', neighborhood: 'Renascença', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA::EDILEUZA NASC', category: 'Instalação', priority: 'alta', status: 'F', teamId: 'colab-11', collaboratorName: 'MARCELINO SOUSA DOS SANTOS',
    scheduledDate: TODAY, scheduledTimeStart: '09:00', scheduledTimeEnd: '11:15', durationMinutes: 135
  },
  {
    ixcId: 'os-229', number: '98529', client: 'PAULO SILVA', address: 'Rua das Flores, 19', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'EX', teamId: 'colab-11', collaboratorName: 'MARCELINO SOUSA DOS SANTOS',
    scheduledDate: TODAY, scheduledTimeStart: '15:00', scheduledTimeEnd: '16:15', durationMinutes: 75
  },
  {
    ixcId: 'os-230', number: '98530', client: 'LETICIA GOMES', address: 'Rua do Passeio, 80', neighborhood: 'Centro', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'A', teamId: 'colab-11', collaboratorName: 'MARCELINO SOUSA DOS SANTOS',
    scheduledDate: TODAY, scheduledTimeStart: '16:15', scheduledTimeEnd: '17:30', durationMinutes: 75
  },

  // MATHEUS MORAES DOS SANTOS
  {
    ixcId: 'os-231', number: '98531', client: 'LUCAS FERREIRA', address: 'Rua Central, 90', neighborhood: 'Turu', city: 'São Luís',
    subject: 'CANCELADO', category: 'Sem conexão', priority: 'baixa', status: 'F', teamId: 'colab-12', collaboratorName: 'MATHEUS MORAES DOS SANTOS',
    scheduledDate: TODAY, scheduledTimeStart: '09:15', scheduledTimeEnd: '09:45', durationMinutes: 30
  },
  {
    ixcId: 'os-232', number: '98532', client: 'GILBERTO', address: 'Rua Sol, 33', neighborhood: 'Centro', city: 'São Luís',
    subject: 'CANCELADO', category: 'Sem conexão', priority: 'baixa', status: 'F', teamId: 'colab-12', collaboratorName: 'MATHEUS MORAES DOS SANTOS',
    scheduledDate: TODAY, scheduledTimeStart: '11:00', scheduledTimeEnd: '11:30', durationMinutes: 30
  },
  {
    ixcId: 'os-233', number: '98533', client: 'RENATO MENEZES', address: 'Rua das Flores, 88', neighborhood: 'Vinhais', city: 'São Luís',
    subject: 'Sinal Ruim::RENATO', category: 'Lentidão', priority: 'media', status: 'EX', teamId: 'colab-12', collaboratorName: 'MATHEUS MORAES DOS SANTOS',
    scheduledDate: TODAY, scheduledTimeStart: '15:00', scheduledTimeEnd: '16:00', durationMinutes: 60
  },
  {
    ixcId: 'os-234', number: '98534', client: 'BEATRIZ COSTA', address: 'Av. Holandeses, 12', neighborhood: 'Calhau', city: 'São Luís',
    subject: 'SEM INTERNET', category: 'Sem conexão', priority: 'alta', status: 'A', teamId: 'colab-12', collaboratorName: 'MATHEUS MORAES DOS SANTOS',
    scheduledDate: TODAY, scheduledTimeStart: '16:15', scheduledTimeEnd: '17:00', durationMinutes: 45
  },

  // MOISES COELHO SOARES
  {
    ixcId: 'os-235', number: '98535', client: 'DENISE', address: 'Rua 5, Qda 2', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'CANCELADO', category: 'Sem conexão', priority: 'baixa', status: 'F', teamId: 'colab-13', collaboratorName: 'MOISES COELHO SOARES',
    scheduledDate: TODAY, scheduledTimeStart: '09:00', scheduledTimeEnd: '09:30', durationMinutes: 30
  },
  {
    ixcId: 'os-236', number: '98536', client: 'FLAVIA', address: 'Rua 6, Qda 3', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'CANCELADO', category: 'Sem conexão', priority: 'baixa', status: 'F', teamId: 'colab-13', collaboratorName: 'MOISES COELHO SOARES',
    scheduledDate: TODAY, scheduledTimeStart: '09:30', scheduledTimeEnd: '10:00', durationMinutes: 30
  },
  {
    ixcId: 'os-237', number: '98537', client: 'AURELIO GOMES', address: 'Rua 7, Qda 4', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'Sinal Ruim::AURELIO', category: 'Lentidão', priority: 'media', status: 'F', teamId: 'colab-13', collaboratorName: 'MOISES COELHO SOARES',
    scheduledDate: TODAY, scheduledTimeStart: '10:30', scheduledTimeEnd: '11:45', durationMinutes: 75
  },
  {
    ixcId: 'os-238', number: '98538', client: 'CLEBER SILVA', address: 'Rua 8, Qda 5', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'MUDANÇA DE ENDEREÇO', category: 'Mudança de endereço', priority: 'media', status: 'EX', teamId: 'colab-13', collaboratorName: 'MOISES COELHO SOARES',
    scheduledDate: TODAY, scheduledTimeStart: '15:00', scheduledTimeEnd: '16:00', durationMinutes: 60
  },
  {
    ixcId: 'os-239', number: '98539', client: 'DIEGO', address: 'Rua 9, Qda 6', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'CANCELADO', category: 'Sem conexão', priority: 'baixa', status: 'A', teamId: 'colab-13', collaboratorName: 'MOISES COELHO SOARES',
    scheduledDate: TODAY, scheduledTimeStart: '16:15', scheduledTimeEnd: '16:45', durationMinutes: 30
  },

  // ROMARIO COELHO SOUZA
  {
    ixcId: 'os-240', number: '98540', client: 'OTICA LUZ', address: 'Av. Guajajaras, 500', neighborhood: 'Tirirical', city: 'São Luís',
    subject: 'ACOMPANHAMENTO TECNICO', category: 'Configuração de roteador', priority: 'media', status: 'F', teamId: 'colab-16', collaboratorName: 'ROMARIO COELHO SOUZA',
    scheduledDate: TODAY, scheduledTimeStart: '09:30', scheduledTimeEnd: '10:30', durationMinutes: 60
  },
  {
    ixcId: 'os-241', number: '98541', client: 'ALINE RAMOS', address: 'Rua das Palma, 44', neighborhood: 'Renascença', city: 'São Luís',
    subject: 'SEM INTERNET', category: 'Sem conexão', priority: 'alta', status: 'F', teamId: 'colab-16', collaboratorName: 'ROMARIO COELHO SOUZA',
    scheduledDate: TODAY, scheduledTimeStart: '11:00', scheduledTimeEnd: '11:45', durationMinutes: 45
  },
  {
    ixcId: 'os-242', number: '98542', client: 'GERALDO ROCHA', address: 'Av. Holandeses, 120', neighborhood: 'Calhau', city: 'São Luís',
    subject: 'SEM INTERNET', category: 'Sem conexão', priority: 'critica', status: 'EX', teamId: 'colab-16', collaboratorName: 'ROMARIO COELHO SOUZA',
    scheduledDate: TODAY, scheduledTimeStart: '15:00', scheduledTimeEnd: '16:00', durationMinutes: 60
  },
  {
    ixcId: 'os-243', number: '98543', client: 'FARMACIA POPULAR', address: 'Av. Colares Moreira, 700', neighborhood: 'Renascença', city: 'São Luís',
    subject: 'ACOMPANHAMENTO', category: 'Configuração de roteador', priority: 'media', status: 'A', teamId: 'colab-16', collaboratorName: 'ROMARIO COELHO SOUZA',
    scheduledDate: TODAY, scheduledTimeStart: '16:30', scheduledTimeEnd: '17:30', durationMinutes: 60
  },

  // WALLACE EVERTON GOMES
  {
    ixcId: 'os-244', number: '98544', client: 'MANUTENÇÃO MANHÃ', address: 'Rede Troncal Centro', neighborhood: 'Centro', city: 'São Luís',
    subject: 'BLOQUEIO TÉCNICO MANHÃ', category: 'Fibra rompida', priority: 'alta', status: 'F', teamId: 'colab-18', collaboratorName: 'WALLACE EVERTON GOMES',
    scheduledDate: TODAY, scheduledTimeStart: '06:00', scheduledTimeEnd: '12:30', durationMinutes: 390
  },
  {
    ixcId: 'os-245', number: '98545', client: 'LOJA CENTRO', address: 'Rua Grande, 450', neighborhood: 'Centro', city: 'São Luís',
    subject: 'SEM INTERNET', category: 'Sem conexão', priority: 'critica', status: 'EX', teamId: 'colab-18', collaboratorName: 'WALLACE EVERTON GOMES',
    scheduledDate: TODAY, scheduledTimeStart: '15:00', scheduledTimeEnd: '16:00', durationMinutes: 60
  },

  // WANDERSON DA SILVA MARINHO
  {
    ixcId: 'os-246', number: '98546', client: 'ROBERTA SILVA', address: 'Rua 1, Qda 10', neighborhood: 'Turu', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-19', collaboratorName: 'WANDERSON DA SILVA MARINHO',
    scheduledDate: TODAY, scheduledTimeStart: '08:30', scheduledTimeEnd: '09:45', durationMinutes: 75
  },
  {
    ixcId: 'os-247', number: '98547', client: 'MARCIO ALMEIDA', address: 'Rua 2, Qda 11', neighborhood: 'Turu', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'F', teamId: 'colab-19', collaboratorName: 'WANDERSON DA SILVA MARINHO',
    scheduledDate: TODAY, scheduledTimeStart: '09:45', scheduledTimeEnd: '11:15', durationMinutes: 90
  },
  {
    ixcId: 'os-248', number: '98548', client: 'CLARISSE NETO', address: 'Rua 3, Qda 12', neighborhood: 'Turu', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'EX', teamId: 'colab-19', collaboratorName: 'WANDERSON DA SILVA MARINHO',
    scheduledDate: TODAY, scheduledTimeStart: '15:00', scheduledTimeEnd: '16:00', durationMinutes: 60
  },
  {
    ixcId: 'os-249', number: '98549', client: 'DENIS ROCHA', address: 'Rua 4, Qda 13', neighborhood: 'Turu', city: 'São Luís',
    subject: 'INSTALAÇÃO VIA FIBRA', category: 'Instalação', priority: 'media', status: 'A', teamId: 'colab-19', collaboratorName: 'WANDERSON DA SILVA MARINHO',
    scheduledDate: TODAY, scheduledTimeStart: '16:00', scheduledTimeEnd: '17:00', durationMinutes: 60
  },

  // WLADIMIR AIRES OLIVEIRA
  {
    ixcId: 'os-250', number: '98550', client: 'SANDRA GOMES', address: 'Av. Colares Moreira, 110', neighborhood: 'Renascença', city: 'São Luís',
    subject: 'ONT COM DEFEITO', category: 'Retirada de equipamentos', priority: 'media', status: 'F', teamId: 'colab-20', collaboratorName: 'WLADIMIR AIRES OLIVEIRA',
    scheduledDate: TODAY, scheduledTimeStart: '09:00', scheduledTimeEnd: '10:00', durationMinutes: 60
  },
  {
    ixcId: 'os-251', number: '98551', client: 'POSTO BR', address: 'Av. Daniel de La Touche, 900', neighborhood: 'Cohama', city: 'São Luís',
    subject: 'ACOMPANHAMENTO', category: 'Configuração de roteador', priority: 'media', status: 'EX', teamId: 'colab-20', collaboratorName: 'WLADIMIR AIRES OLIVEIRA',
    scheduledDate: TODAY, scheduledTimeStart: '15:00', scheduledTimeEnd: '16:00', durationMinutes: 60
  },
  {
    ixcId: 'os-252', number: '98552', client: 'COLEGIO SANTA ROSA', address: 'Rua do Sol, 55', neighborhood: 'Centro', city: 'São Luís',
    subject: 'ACOMPANHAMENTO', category: 'Configuração de roteador', priority: 'media', status: 'A', teamId: 'colab-20', collaboratorName: 'WLADIMIR AIRES OLIVEIRA',
    scheduledDate: TODAY, scheduledTimeStart: '16:00', scheduledTimeEnd: '17:00', durationMinutes: 60
  }
]

export const MOCK_CLUSTERS: IncidentCluster[] = [
  {
    id: 'cluster-1',
    title: 'POSSÍVEL FUSÃO / QUEDA CTO-TIR-01 (Tirirical)',
    category: 'Fibra rompida',
    city: 'São Luís',
    neighborhood: 'Tirirical',
    ctoName: 'CEO-TIR-01',
    affectedCount: 8,
    lat: -2.551,
    lng: -44.217,
    osIds: ['os-103'],
    severity: 'critica',
  },
  {
    id: 'cluster-2',
    title: 'ALERTA DE SINAL FRACO / ATENUAÇÃO (Calhau)',
    category: 'Sem conexão',
    city: 'São Luís',
    neighborhood: 'Calhau',
    ctoName: 'CTO-HOL-09',
    affectedCount: 4,
    lat: -2.489,
    lng: -44.271,
    osIds: ['os-107'],
    severity: 'alta',
  },
]

export const MOCK_STATS: DashboardStats = {
  active: 7,
  total: 15,
  osToday: 32,
  osDone: 18,
  osProgress: 4,
  osPending: 10,
  avgTime: 38,
  completionRate: 78,
  osOpen: 8,
  osOverdue: 2,
  clientsWaiting: 6,
  onlineTechs: 6,
  attendingTechs: 2,
  drivingTechs: 1,
  stoppedTechs: 1,
  offlineTechs: 1,
  avgDriveTime: 14,
  avgServiceTime: 28,
  slaComplianceRate: 94,
}

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-1',
    type: 'danger',
    title: '💥 Alerta de Rompimento Massivo',
    message: 'Detectadas 8 O.S. de "Sem Conexão" ancoradas na CEO-TIR-01 (Tirirical). Equipe Delta atribuída.',
    neighborhood: 'Tirirical',
    timestamp: new Date(),
  },
  {
    id: 'alert-2',
    type: 'warning',
    title: '⚠️ SLA Restante Crítico (< 30 min)',
    message: 'O.S. 98412 (Renascença) com SLA vencendo em 45 minutos. Equipe Alpha a 6 min de distância.',
    osId: 'os-101',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: 'alert-3',
    type: 'info',
    title: '💡 Sugestão de Auto-Dispatch',
    message: 'Equipe Charlie está DISPONÍVEL a 1.2km da O.S. 98425 (Calhau). Clique para atribuir.',
    technician: 'Equipe Charlie',
    osId: 'os-105',
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
  },
]
