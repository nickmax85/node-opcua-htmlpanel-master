const express = require("express");
const chalk = require("chalk");
const socketIO = require("socket.io");
const port = 3700;

const {
    AttributeIds,
    OPCUAClient,
    TimestampsToReturn,
} = require("node-opcua");


const hostname = require("os").hostname().toLowerCase();
// const endpointUrl = "opc.tcp://" + hostname + ":26543/UA/SampleServer";
const endpointUrl = "opc.tcp://10.187.136.55:4840/";
const nodeIdToMonitor = "ns=2;s=510383.MES_DB_GEN.PU.Write.CycleTime";
const nodeIdStationNumber = "ns=2;s=510383.MES_DB_GEN.HEAD.stationNumber";
const nodeIdGood = "ns=2;s=510383.MES_DB_GEN.PU.Write.Good";
const nodeIdScrap = "ns=2;s=510383.MES_DB_GEN.PU.Write.Scrap";
const nodeIdState = "ns=2;s=510383.MES_DB_GEN.PU.Write.State";

(async () => {
    try {
        const client = OPCUAClient.create({
            // securityMode: opcua.MessageSecurityMode.None,
            // securityPolicy: opcua.SecurityPolicy.None,        
            endpoint_must_exist: false
        });
        client.on("backoff", (retry, delay) => {
            console.log("Retrying to connect to ", endpointUrl, " attempt ", retry);
        });
        console.log(" connecting to ", chalk.cyan(endpointUrl));
        await client.connect(endpointUrl);
        console.log(" connected to ", chalk.cyan(endpointUrl));

        const session = await client.createSession({
            userName: "opc",
            password: "opc",

        });
        console.log(" session created".yellow);

        const subscription = await session.createSubscription2({
            requestedPublishingInterval: 2000,
            requestedMaxKeepAliveCount: 20,
            requestedLifetimeCount: 6000,
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            priority: 10
        });

        subscription.on("keepalive", function () {
            console.log("keepalive");
        }).on("terminated", function () {
            console.log(" TERMINATED ------------------------------>")
        });

        // --------------------------------------------------------
        const app = express();
        app.set('view engine', 'html');
        app.use(express.static(__dirname + '/'));
        app.set('views', __dirname + '/');
        app.get("/", function (req, res) {
            res.render('index.html');
        });

        app.use(express.static(__dirname + '/'));

        const io = socketIO.listen(app.listen(port));

        io.sockets.on('connection', function (socket) {
        });

        console.log("Listening on port " + port);
        console.log("visit http://localhost:" + port);
        // --------------------------------------------------------

        const itemToMonitor = {
            nodeId: nodeIdStationNumber,
            attributeId: AttributeIds.Value
        };
        const parameters = {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        };
        const monitoredItem = await subscription.monitor(itemToMonitor, parameters, TimestampsToReturn.Both);

        monitoredItem.on("changed", (dataValue) => {
            console.log(dataValue.value.toString());
            io.sockets.emit('message', {
                value: dataValue.value.value,
                timestamp: dataValue.serverTimestamp,
                nodeId: nodeIdStationNumber,
                browseName: "510383.MES_DB_GEN.HEAD.stationNumber"
            });
        });

        const itemToMonitor2 = {
            nodeId: nodeIdToMonitor,
            attributeId: AttributeIds.Value
        };
        const parameters2 = {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        };
        const monitoredItem2 = await subscription.monitor(itemToMonitor2, parameters2, TimestampsToReturn.Both);

        monitoredItem2.on("changed", (dataValue) => {
            console.log(dataValue.value.toString());
            io.sockets.emit('message', {
                value: dataValue.value.value,
                timestamp: dataValue.serverTimestamp,
                nodeId: nodeIdToMonitor,
                browseName: "510383.MES_DB_GEN.PU.Write.CycleTime"
            });
        });

        const itemToMonitor3 = {
            nodeId: nodeIdGood,
            attributeId: AttributeIds.Value
        };
        const parameters3 = {
            samplingInterval: 100,
            discardOldest: true,
            queueSize: 100
        };
        const monitoredItem3 = await subscription.monitor(itemToMonitor3, parameters3, TimestampsToReturn.Both);

        monitoredItem3.on("changed", (dataValue) => {
            console.log(dataValue.value.toString());
            io.sockets.emit('message', {
                value: dataValue.value.value,
                timestamp: dataValue.serverTimestamp,
                nodeId: nodeIdGood,
                browseName: "510383.MES_DB_GEN.PU.Write.Good"
            });
        });

        // detect CTRL+C and close
        let running = true;
        process.on("SIGINT", async () => {
            if (!running) {
                return; // avoid calling shutdown twice
            }
            console.log("shutting down client");
            running = false;

            await subscription.terminate();

            await session.close();
            await client.disconnect();
            console.log("Done");
            process.exit(0);

        });

    }
    catch (err) {
        console.log(chalk.bgRed.white("Error" + err.message));
        console.log(err);
        process.exit(-1);
    }
})();

