#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
from os import path
sys.path.append( path.dirname( path.dirname( path.abspath(__file__) ) ) )
from generatePayments import satoshi, makeConnection
import random
import decimal
from decimal import Decimal
import time
import math
import csv
import pickle
import sys
import json
import datetime
from prettytable import PrettyTable

bet_type_count = [0, 1, 1, 2]

def spreadAmmount(conn, num_addrs, amount):
    print('Spreading the ammount to use into different new addresses')
    bal = conn.getbalance()
    if bal < amount:
        print('Warning: requested to use {} BTCs, but there are only {} BTCs available. Using it all...'.format(amount, bal))
        amount = bal

    mean_amount = float(amount) / num_addrs
    std_dev = 0.3 * mean_amount
    
    output = {}

    bal = amount
    while bal > Decimal(0):
        val = Decimal(random.gauss(mean_amount, std_dev)).quantize(satoshi)
        bal -= val
        if bal < Decimal(0):
            val += bal
        new_addr = conn.getnewaddress()
        output[new_addr] = val
        print(new_addr, val)
    del bal

    unspent = conn.listunspent()
    tx_in = []
    total_in = Decimal(0)

    for t in unspent:
        tx_in.append({'txid': t['txid'], 'vout': t['vout']})
        total_in += t['amount']
        if total_in > amount:
            break

    # calculate change
    if amount < total_in:
        change = conn.getnewaddress()
        output[change] = total_in - amount
    else:
        change = None

    raw_trans = conn.createrawtransaction(tx_in, output)
    if change:
        del output[change]

    print "\nAddresses count: ", len(output)
    try:
        print('Signing...')
        s_trans = conn.signrawtransaction(raw_trans)
        print('Sending...')
        tid = conn.sendrawtransaction(s_trans['hex'])
        print '  sent, transaction hash:\n', tid
    except Exception, e:
        print e.__dict__

    # TODO: account for transaction malleability
    print('Waiting first confirmation...')
    while conn.gettransaction(tid)['confirmations'] < 1:
        time.sleep(10)
    print('  confirmed!')

    vouts = []
    for vout in conn.decoderawtransaction(raw_trans)['vout']:
        addr = vout['scriptPubKey']['addresses'][0]
        if addr != change:
            vouts.append({'address': addr, 'n': vout['n'], 'value': vout['value'], 'tid': tid})
    return vouts

def makeBets(conn, bets_choices, b_id, part):
    print 'Bettor ', b_id
    total_value = sum((p['value'] for p in part))

    # for each bet, decide if is going to bet in one side, two sides or both
    choices = [random.randrange(4) for i in range(len(bets_choices))]

    # split all the money in the number of bets that will be made
    num_bets = 0
    for c in choices:
        num_bets += bet_type_count[c]

    # Choose the value to use in each bet:

    if total_value <= num_bets * satoshi:
        # If the total value to bet is very small,
        # fix one satoshi for each bet.
        num_bets = int(total_value / satoshi)
        partial = 0
        for i in range(len(choices)):
            c = choices[i]
            if num_bets - partial >= 2:
                partial += bet_type_count[c]
            elif (num_bets - partial) == 1:
                if bet_type_count[c] <= 1:
                    partial += bet_type_count[c]
                else:
                    choices[i] = random.randrange(1,3)
                    partial += 1
            else:
                choices[i] = 0
        val_split = [satoshi] * num_bets

    else:
        # If there are more satoshis than bets, shuffles each
        # value around the mean.
        decimal.getcontext().rounding = decimal.ROUND_DOWN
        mean = (total_value / num_bets).quantize(satoshi)
        val_split = [mean] * num_bets
        for i in range(int((total_value - (num_bets * mean)) / satoshi)):
            val_split[i] += satoshi
        assert(sum(val_split) == total_value)

        mean = float(mean) * 0.35
        for i in range(len(val_split)-1):
            disp = Decimal(random.gauss(0.0, mean)).quantize(satoshi)
            val_split[i] += disp
            val_split[i+1] -= disp

            if val_split[i] <= 0:
                val_split[i+1] += val_split[i] - satoshi
                val_split[i] = satoshi

            elif val_split[i+1] <= 0:
                val_split[i] += val_split[i+1] - satoshi
                val_split[i+1] = satoshi

        for v in val_split:
            assert(v > 0)
        assert(sum(val_split) == total_value)

    outputs = {}
    bet_table = []
    print '  Number of outputs: ', len(val_split)
    print '  Betting choices: ', choices
    print '  Values split: ', val_split
    print '  Part inputs: ', part

    # Assemble the bets outputs
    for i,options in enumerate(bets_choices):
        if choices[i] == 1:
            val = val_split.pop()
            outputs[options[0]] = val
            bet_table.append((val, Decimal(0)))
        elif choices[i] == 2:
            val = val_split.pop()
            outputs[options[1]] = val
            bet_table.append((Decimal(0), val))
        elif choices[i] == 3:
            vals = [val_split.pop() for i in range(2)]
            outputs[options[0]] = vals[0]
            outputs[options[1]] = vals[1]
            bet_table.append(vals)
        else:
            bet_table.append((Decimal(0), Decimal(0)))

    assert(not val_split)
    print '  Assembled outputs:', outputs

    print('  Sending bets...'.format(b_id))
    tx_in = [{'txid': t['tid'], 'vout': t['n']} for t in part]
    raw_trans = conn.createrawtransaction(tx_in, outputs)
    s_trans = conn.signrawtransaction(raw_trans)
    decoded_trans = conn.decoderawtransaction(s_trans['hex'])
    print '  Signed and assembled transaction:', decoded_trans

    assert(len(tx_in) == len(part))
    print '  Total input: ', total_value
    total_output = sum([o['value'] for o in decoded_trans['vout']])
    print '  Total output:', total_output
    if total_value != total_output:
        print 'ERROR: total input and total output values mismatch! Aborting!'
        sys.exit(1)

    new_tid = conn.sendrawtransaction(s_trans['hex'])
    print '    sent, transaction hash:', new_tid
    print '=====================================\n'

    return bet_table

def simulateBets(conn, num, holders):
    bets = []
    for b in range(num):
        bets.append([conn.getnewaddress() for i in range(2)])

    # write bets in the format accepted by 'generatePayments.py' script
    for i, bet in enumerate(bets):
        with open('payable_bet_{}.json'.format(i+1), 'w') as jsonfile:
            parts = [{'name': 'Side {}'.format(chr(ord('A') + j)),
                     'address': addr}
                    for j,addr in enumerate(bet)]
            date_over = datetime.datetime.utcnow() + datetime.timedelta(hours=2)

            output = {'parts': parts,
                    'date-over': date_over.isoformat(),
                    'winner': random.choice(parts)['name'],
                    'tax-addr': 'msry1xNmiFbpLikyxNMjTkSzFqwkywBLtW'}
            json.dump(output, jsonfile, indent=4)

    # holders is now a list of lists, each list is a bettor
    bettor_choices = []
    for i in range(len(holders)):
        bettor_choices.append(
            makeBets(conn, bets, i+1, holders[i])
        )

    # write bettors choices
    with open('bets_chart.csv', 'w') as csvfile:
        csvw = csv.writer(csvfile)

        # header
        line = ['Bet choices:']
        for i in range(len(bets)):
            line += [str(i+1), '']
        csvw.writerow(line)

        line = ['Bettor']
        for a1, a2 in bets:
            line.append(a1)
            line.append(a2)
        csvw.writerow(line)

        # data
        for i, bet_table in enumerate(bettor_choices):
            line = [str(i+1)]
            for v1,v2 in bet_table:
                line.append(v1)
                line.append(v2)
            csvw.writerow(line)

def chunks(l, n):
    n = max(1, n)
    return [l[i:i + n] for i in range(0, len(l), n)]

def calc_ratio(a, b):
    try:
        return float(a) / float(b)
    except ZeroDivisionError:
        if float(a) == 0.0:
            return 'indef'
        else:
            return '∞'

def getTransactionByInputAddress(conn, addrs):
    addrs = set(addrs)
    ret = conn.listtransactions('', 15, 0)
    ret.reverse()
    ini = 15
    last_txid = None
    while len(ret) >= 15:
        for t in ret:
            if t['txid'] != last_txid:
                last_txid = t['txid']
                trans = conn.decoderawtransaction(conn.getrawtransaction(t['txid']))
                for vin in trans['vin']:
                    in_trans = conn.decoderawtransaction(conn.getrawtransaction(vin['txid']))
                    try:
                        if set(in_trans['vout'][vin['vout']]['scriptPubKey']['addresses']) & addrs:
                            return trans
                    except KeyError:
                        pass
        ret = conn.listtransactions('', 15, ini)
        ret.reverse()
        ini += 15
    return None

def verifyPreviousBet(conn):
    with open('bets_chart.csv', 'r') as csvfile:
        csvr = csv.reader(csvfile)
        bettor_choices = [chunks(list(row)[1:], 2) for row in csvr]
        addresses = bettor_choices[1]
        bettor_choices = bettor_choices[2:]

    bettors = readBettors()
    num_bettors = len(bettors)
    assert(len(bettor_choices) == num_bettors)

    # Associating one address with each bettor
    btor_id = {}
    for i, addrs in enumerate(bettors):
        for addr in addrs:
            btor_id[addr['address']] = i

    for i, addrs in enumerate(addresses):
        print "Bet {}:".format(i+1)

        table = PrettyTable(['Bettor', 'Side A', 'Side B', 'Won', 'Won / A', 'Won / B'])
        unknown = Decimal(0)
        received = [Decimal(0)] * num_bettors
        transaction = getTransactionByInputAddress(conn, addrs)
        print "Transactio id:", transaction['txid']
        print "{} (Side A) vs. {} (Side B)".format(*addrs)
        if not transaction:
            print '  it seems this bet was not paid yet...'
            continue

        for out in transaction['vout']:
            addr = out['scriptPubKey']['addresses'][0]
            try:
                j = btor_id[addr]
                received[j] += out['value']
            except KeyError:
                unknown += out['value']

        totals = [Decimal(0)] * 2
        for j, bchoice in enumerate(bettor_choices):
            ratios = [calc_ratio(received[j], bchoice[i][side])
                for side in (0,1)]

            table.add_row([j, bchoice[i][0], bchoice[i][1], received[j]] + ratios)
            #print "{}\t\t{:10.8}\t{:10.8}\t{:10.8}\t{:10.8}\t{:10.8}".format(j, bchoice[i][0], bchoice[i][1], received[j], *ratios)
            for side in (0, 1):
                totals[side] += Decimal(bchoice[i][side])

        ratios = [calc_ratio(totals[a], totals[b]) for a,b in ((1,0),(0,1))]

        table.add_row(['Total:', totals[0], totals[1], sum(totals)] + ratios)
        #print "Total:\t{:10.8}\t{:10.8}\t{:10.8}\t{:10.8}\t{:10.8}".format(totals[0], totals[1], sum(totals), *ratios)
        print table
        print "Ammount not distributed (fees):", unknown
        print "\n\n"

def writeBettors(bettors):
    with open('bettors.pickle', 'wb') as jfile:
        pickle.dump(bettors, jfile, pickle.HIGHEST_PROTOCOL)

def readBettors():
    with open('bettors.pickle', 'rb') as jfile:
        return pickle.load(jfile)

def splitBettors(spread):
    random.shuffle(spread)

    split = [0]
    while split[-1] < len(spread):
        # Generate a number >= 1, with exponentially smaller probabilities
        # for greater numbers
        size = int(math.ceil(random.expovariate(0.9)*1.3))
        end = min(split[-1] + size, len(spread))
        split.append(end)

    holders = []
    for i in range(len(split)-1):
        holders.append(spread[split[i]:split[i+1]])
    del spread

    writeBettors(holders)

    return holders

def usageError():
    print("Error: missing parameters. Usage:\n  {0} make_bets <btc_amount> <spread_count> <bets_count>\nor\n  {0} verify\nor\n  {0} skip_spread <bets_count>\nWhere:\n  <btc_amount>: number of BTC to use in the simulation;\n  <spread_count>: spread BTC ammout to approximatelly this number of different addresses;\n  <bets_count>: Number of simultaneous bets to simulate.".format(sys.argv[0]))
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        usageError()
    
    conn = makeConnection()

    if sys.argv[1] == 'make_bets':
        try:
            amount = Decimal(sys.argv[2]).quantize(satoshi)
            spread_count = int(sys.argv[3])
            bets_count = int(sys.argv[4])
        except (IndexError, ValueError, decimal.InvalidOperation):
            usageError()

        bettors = spreadAmmount(conn, spread_count, amount)
        bettors = splitBettors(bettors)
        simulateBets(conn, bets_count, bettors)
    elif sys.argv[1] == 'skip_spread':
        try:
            bets_count = int(sys.argv[2])
        except (IndexError, ValueError):
            usageError()

        bettors = readBettors()
        simulateBets(conn, bets_count, bettors)
    elif sys.argv[1] == 'verify':
        verifyPreviousBet(conn)
    else:
        usageError()

if __name__ == '__main__':
    main()
