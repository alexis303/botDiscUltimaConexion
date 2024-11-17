require('dotenv').config({ path: '../.env' });
const token = process.env.DISCORD_TOKEN;
const { Client, GatewayIntentBits, Partials, ChannelType } = require('discord.js');  // Agregar ChannelType
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,  // Para detectar cuando un miembro entra al servidor
        GatewayIntentBits.GuildVoiceStates,  // Para detectar cambios en los canales de voz
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

const LOG_CHANNEL_NAME = 'registro-conexiones';  // Nombre del canal donde se registrarán las conexiones
const lastSeenData = new Map();  // Mapa para almacenar la última conexión de cada usuario
let logMessageId = null;  // ID del mensaje donde se registran las conexiones

// Evento cuando el bot está listo
client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);

    // Obtener el servidor donde el bot está presente
    const guild = client.guilds.cache.first();  // Asumimos que el bot está en al menos un servidor

    // Verificar si ya existe el canal
    let logChannel = guild.channels.cache.find(channel => channel.name === LOG_CHANNEL_NAME);

    if (!logChannel) {
        console.log(`El canal ${LOG_CHANNEL_NAME} no existe, creándolo...`);
        // Crear el canal de texto 'registro-conexiones'
        logChannel = await guild.channels.create({
            name: LOG_CHANNEL_NAME,
            type: ChannelType.GuildText,  // Asegurarse de que el tipo sea texto
            topic: 'Canal de registro de conexiones',  // Opción de agregar un tema
            reason: 'Creación automática del canal de registro de conexiones',
        });
        console.log(`Canal ${LOG_CHANNEL_NAME} creado con éxito.`);
    }

    // Obtener todos los miembros conectados a canales de voz en ese momento
    const connectedMembers = guild.members.cache.filter(member => member.voice.channel).map(member => member.displayName);

    // Registrar los miembros conectados con la fecha actual
    const now = new Date().toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',  // Incluir segundos
    });

    connectedMembers.forEach(memberName => {
        if (!lastSeenData.has(memberName)) {
            lastSeenData.set(memberName, now);  // Agregar el nombre del usuario y la fecha
        }
    });

    // Crear o actualizar el mensaje de registro
    const fetchedMessages = await logChannel.messages.fetch({ limit: 10 });
    const existingMessage = fetchedMessages.find(msg => msg.author.id === client.user.id);

    if (existingMessage) {
        logMessageId = existingMessage.id;
    } else {
        const newMessage = await logChannel.send('Inicializando registro de conexiones...');
        logMessageId = newMessage.id;
    }

    // Actualizar el mensaje con los miembros conectados
    await updateLogMessage(guild);
});

// Evento cuando un nuevo miembro se une al servidor
client.on('guildMemberAdd', async (member) => {
    const now = new Date().toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',  // Asegurar que los segundos se incluyan
    });

    // Si el miembro no está en el registro, se agrega
    if (!lastSeenData.has(member.displayName)) {
        lastSeenData.set(member.displayName, now);
        await updateLogMessage(member.guild);  // Actualiza el mensaje con el nuevo registro
    }
});

// Evento cuando un usuario cambia de estado en un canal de voz
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;
    const now = new Date().toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',  // Asegurar que los segundos se incluyan
    });

    // Verificar si el usuario ha entrado en un canal de voz y si su estado anterior era desconectado
    if (newState.channel && !oldState.channel) {
        // El usuario está entrando a un canal de voz por primera vez o regresando
        if (!lastSeenData.has(member.displayName)) {
            lastSeenData.set(member.displayName, now);  // Agregar el nombre del usuario y la fecha
        } else {
            // Si ya está en la lista, actualizamos la hora
            lastSeenData.set(member.displayName, now);  // Actualizar la fecha
        }
        await updateLogMessage(newState.guild);  // Actualizar el mensaje con el nuevo registro
    }
});

// Función para actualizar el mensaje de registro
async function updateLogMessage(guild) {
    const logChannel = guild.channels.cache.find(channel => channel.name === LOG_CHANNEL_NAME);

    if (!logChannel || !logMessageId) return;

    const logContent = Array.from(lastSeenData.entries())
        .map(([name, time]) => `F: ${time} \t \t${name}`)
        .join('\n');

    const logMessage = await logChannel.messages.fetch(logMessageId);
    await logMessage.edit(logContent || 'No hay datos de conexión registrados aún.');
}

// Iniciar el bot
client.login(token);
