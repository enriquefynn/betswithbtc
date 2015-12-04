#!/usr/bin/env python
# -*- coding: utf-8 -*-
import sys
import decimal
import getopt
import os
import itertools
import dateutil.parser
from datetime import datetime
from decimal import Decimal
from fractions import Fraction
from unittest import TestCase, main as unitmain
from bitcoinrpc.authproxy import AuthServiceProxy
import json

satoshi = Decimal('0.00000001')
defaults = None

"""
Some tests
"""
class TestBlockchainRequests(TestCase):
 
    def setUp(self):
        conf = loadConf()
        self.conn = AuthServiceProxy("http://{}:{}@127.0.0.1:{}".format(conf['rpcuser'], conf['rpcpassword'], conf['rpcport']))

    def test_getAddressBalance(self):
        addrwon = "mtCzUakqm1TPanuFeb1JsiXGd59sX9ivEn"
        addrlost = "mtYuri4XNHB8HnKkEBWCvUiASM8ASFeqBn"
        taxaddr = "n2WBgU1JEMgPJUkboW6u6QJJwooVjqTdbX"
        datebegun = datetime(2014, 3, 17, 22, 44)
        dateover = datetime(2014, 5, 8, 23, 59)
        generateRawTransaction(self.conn, addrwon, addrlost, taxaddr, datebegun, dateover)

    def test_getAddressMissingdates(self):
        addrwon = "mtCzUakqm1TPanuFeb1JsiXGd59sX9ivEn"
        addrlost = "mtYuri4XNHB8HnKkEBWCvUiASM8ASFeqBn"
        taxaddr = "n2WBgU1JEMgPJUkboW6u6QJJwooVjqTdbX"
        datebegun = datetime(2014, 3, 17, 22, 44)
        dateover = datetime(2014, 5, 8, 1, 17, 48)
        generateRawTransaction(self.conn, addrwon, addrlost, taxaddr, datebegun, dateover)

"""
Loads defaults options to be used if not provided during invocation.
"""
def loadDefaults():
    global defaults
    defaults = {
        'tax': '0.1',
        'tax-addr': '19F8BacznMiMahBwCWsR2hLXPzugPR9RnT',
        'date-begun': '2009-01-03T00:00:00'
    }

    path = os.path.dirname(os.path.realpath(__file__))
    path = os.path.join(path, 'defaults.json')
    try:
        with open(path, 'r') as jsonfile:
            defaults.update(json.load(jsonfile))
    except IOError:
        pass

"""
Main
"""
def main(argv):
    global defaults
    def usage():
        print('-h, --help:\t  This screen\
             \n-f, --file <filename>: read inputs from file, multiple files may be specified')

    loadDefaults()

    try:
        files = []
        tx = defaults['tax']
        taxaddr = defaults['tax-addr']
        datebegun = dateutil.parser.parse(defaults['date-begun'])

        opts, args = getopt.getopt(argv, "hf:", ["help", "file="])
        for (opt, arg) in opts:
            if opt in ('-h', '--help'):
                usage()
                sys.exit(0)
            elif opt in('-f', '--file'):
                files.append(arg)

        tx = defaults['tax']
        taxaddr = defaults['tax-addr']
        datebegun = dateutil.parser.parse(defaults['date-begun'])
    except getopt.GetoptError as err:
        print err, '\n'
        usage()
        sys.exit(2)

    if not files:
        print('Error, no input file specified. Usage:')
        usage()
        sys.exit(3)

    connection = makeConnection()
    for fname in files:
        processInputFile(connection, fname)

def processInputFile(connection, fname):
    global defaults
    try:
        with open(fname, 'r') as jsonfile:
            options = json.load(jsonfile)
    except IOError as e:
        print 'Could not open file {}: {},\n   skipping it...'.format(fname, e.strerror) 
        return

    # Optional parameters:
    try:
        tax = options['tax']
    except KeyError:
        tax = defaults['tax']

    try:
        taxaddr = options['tax-addr']
    except KeyError:
        taxaddr = defaults['tax-addr']

    try:
        datebegun = options['date-begun']
    except KeyError:
        datebegun = defaults['date-begun']

    tax = Decimal(tax)
    datebegun = dateutil.parser.parse(datebegun)

    # Required parameters:
    parts = {p['name'] : p['address'] for p in options['parts']}
    addrwon = parts[options['winner']]
    del parts[options['winner']]
    
    assert(len(parts) == 1)
    [addrlost] = parts.values()

    dateover = dateutil.parser.parse(options['date-over'])

    rawtx = generateRawTransaction(connection, addrwon, addrlost, taxaddr, datebegun, dateover, tax)

    #Sign transaction
    print "Txid: ", signSendRawTransaction(connection, rawtx)

"""
Load bitcoin conf from bitcoin.conf
"""
def loadConf():
    conf = {}
    path = os.path.expanduser('~/.bitcoin/bitcoin.conf')
    with open(path) as f:
        lines = f.readlines()
    for line in lines:
        c = line.strip('\n').rsplit('=')
        conf[c[0]] = c[1]
    return conf

def makeConnection():
    conf = loadConf()
    return AuthServiceProxy("http://{}:{}@127.0.0.1:{}".format(conf['rpcuser'], conf['rpcpassword'], conf['rpcport']))


"""
Calculates transaction fee
"""
def calculateTxFee(inps, outs):
    fee = Decimal('0')
    for out in outs.values():
        if out < Decimal('0.01'):
            fee = Decimal('0.0001')
    
    #Crazy math from http://bitcoinfees.com/ below
    transaction_len = 148*len(inps) + 34*len(outs) + 10
    bt_s = 0
    if fee == 0:
        for inp in inps:
            bt_s+= inp['amount']*inp['confirmations']
    
    if bt_s/transaction_len >= Decimal('0.576'):
        return fee
    if transaction_len > 10000:
        fee = Decimal('0.0001') * int(transaction_len/1000)
    return fee

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return str(o)
        return super(DecimalEncoder, self).default(o)

"""
Sign and send transaction
"""
def signSendRawTransaction(conn, raw_tx):
    fname = 'bet_payments.json'
    with open(fname, 'w') as f:
        json.dump(conn.decoderawtransaction(raw_tx), f, indent=4, separators=(',', ': '), cls=DecimalEncoder)
    os.system('less ' + fname)

    while True:
        ans = raw_input('Enviando a transação (no arquivo "{}"),\nesta certo disso? (sim/nao): '.format(fname))
        if ans == 'sim':
            signed_tx = conn.signrawtransaction(raw_tx)
            return conn.sendrawtransaction(signed_tx['hex'])
        elif ans == 'nao':
            return

def getLastSendToAddress(conn, txid):
    raw_tx = conn.decoderawtransaction(conn.getrawtransaction(txid))
    w_addr = None
    for inp in raw_tx['vin']:
        decoded_tx_vin = conn.decoderawtransaction(conn.getrawtransaction(inp['txid']))
        try:
            w_addr = decoded_tx_vin['vout'][inp['vout']]['scriptPubKey']['addresses'][0]
            break
        except KeyError:
            e = sys.exc_info()[0]
            print('Could not get last-send-to address:')
            print(e)
            print(' trying next input transaction...')
    return w_addr

def classifyInputs(conn, winner_addr, loser_addr):
    # At least 7 confirmations and I'm in sync with the blockchain
    idx_last_block = conn.getblockcount()
    while True:
        unspent = conn.listunspent(7)
        if conn.getblockcount() == idx_last_block:
            break
        idx_last_block = conn.getblockcount()

    losers = {}
    winners = {}
    invalids = {}

    for transaction in unspent:
        if transaction['address'] not in (winner_addr, loser_addr):
            continue

        blocktime = conn.getblock(conn.getblockhash(idx_last_block - transaction['confirmations']+1))['time']
        dateTransaction = datetime.utcfromtimestamp(blocktime)

        key = (transaction['txid'], transaction['vout'])
        val = transaction['amount']

        if dateTransaction < dateInit or dateTransaction > dateEnd:
            # Invalid transaction
            invalids[key] = val

        elif transaction['address'] == winner_addr:
            winners[key] = val

        elif transaction['address'] == loser_addr:
            losers[key] = val

    return winners, losers, invalids

class Payout:
    def __init__(self):
        self.d = {}

    def accum(self, key, value):
        if value == Decimal(0):
            return

        self.d[key] = self.d.get(key, Decimal(0)) + value

    def outputPrint(self, msg):
        print msg
        for addr in self.d:
            value = self.d[addr]
            print "  {} -> {}, {}".format(addr, float(value), str(type(value)))

    def __add__(self, other):
        ret = Payout()
        ret.d = self.d.copy()

        for k in other.d:
            ret.accum(k, other.d[k])

        return ret

def generateRawTransaction(conn, winner_addr, loser_addr, tax_addr,
        dateInit, dateEnd, tax):
    print('Do dia {} ao {}'.format(dateInit, dateEnd)) 
    print('Cobrando {}%'.format(float(100*tax)))

    winners, losers, invalids = classifyInputs(winner_addr, loser_addr)

    # Transaction inputs
    raw_ins = [{'txid': txid, 'vout': vout} for txid, vout in
            itertools.chain(winners.iterkeys(), losers.iterkeys(), invalids.iterkeys())]

    if not raw_ins:
        return

    refundpayments = Payout()
    winnerpayments = Payout()

    weird_transaction = []

    winners_total = Decimal(0)
    split_total = Decimal(0)

    def deal_weird(txid, amount):
        weird_transactions.append(txid)
        split_total += amount

    for k in invalids:
        # Invalid bet, trying to return the money
        ret_addr = getLastSendToAddress(conn, k[0])
        if ret_addr:
            refundpayments.accum(ret_addr, invalids[k])
        else:
            deal_weird(k[0], invalids[k])

    for k in winners:
        # Getting last-send-to address
        w_addr = getLastSendToAddress(conn, transaction['txid'])
        value = winners[k]

        #Give winners their money
        if w_addr:
            winners_total += value
            winnerpayments.accum(w_addr, value)
        else:
            deal_weird(k[0], value)

    split_total += sum(losers.itervalues()) 
    purse = split_total

    #Our cut
    decimal.getcontext().rounding=decimal.ROUND_UP
    tax_ammount = Fraction(purse) * Fraction(tax)
    tax_ammount = (Decimal(tax_ammount.numerator)/Decimal(tax_ammount.denominator)).quantize(satoshi)
    if tax_ammount > 0:
        purse -= tax_ammount
    else:
        tax_ammount = Decimal(0)
    
    #FIXME: Should fee be taken by both parties?
    #I think that the strong advertising of losing nothing
    #is exploitable
    tx_fee = calculateTxFee(payments_in, payments_out)
    purse -= tx_fee
    if purse < Decimal(0):
        tx_fee += purse
        purse = Decimal(0)

    if winners_total > Decimal(0):
        # Distribute split money proportionally to the winners
        decimal.getcontext().rounding=decimal.ROUND_DOWN
        distributed_total = Decimal('0')
        for p in winnerpayments.d:
            value = winnerpayments.d[p] 
            p_share = Fraction(str(value))
            p_share /= Fraction(str(winners_total))
            profit = Fraction(str(purse)) * p_share
            profit_amount = (Decimal(profit.numerator) / Decimal(profit.denominator)).quantize(satoshi)
            winnerpayments.accum(p, profit_amount)

        # The difference is left to the transaction
        purse -= distributed_total
        assert(purse >= Decimal(0))
        tx_fee += purse
        purse = Decimal(0)
    else:
        # No one bet in the winner
        pass

    print "Total stake:", winners_total + split_total
    print "Winners ammount:", winners_total
    print "Losers and weirds ammount:", split_total
    print "Our cut:", tax_ammount
    print "Transaction fee:", tx_fee
    print "Total winners profit:", distributed_total

    winnerpayments.outputPrint("\nWinner payments:")
    refundpayments.outputPrint("\nRefund payments:")

    if weird_transactions:
        print("\nWeird transactions found (ammount redistributed):")
        for t in weird_transactions:
            print(t)

    # Sum up payouts
    allpayments = winnerpayments + refundpayments

    #Insert our fee into the transaction:
    allpayments.accum(tax_addr, tax_ammount)

    hex_tx = conn.createrawtransaction(raw_ins, allpayments.d)
    return hex_tx

if __name__ == '__main__':
    main(sys.argv[1:])
